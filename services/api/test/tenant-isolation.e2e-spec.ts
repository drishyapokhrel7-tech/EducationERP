import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * Exercises the exact cross-tenant scenarios plan §4/§7 call out: reads,
 * writes, direct-ID access, and RLS as a backstop independent of the
 * service-layer WHERE clause. Runs against the real dev database (no
 * separate test DB was provisioned in Phase 1) — every row it creates is
 * deleted in afterAll.
 */
describe("Tenant isolation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const run = Date.now();
  const orgAEmail = `admin-a-${run}@rls-e2e.test`;
  const orgBEmail = `admin-b-${run}@rls-e2e.test`;
  const orgASlug = `rls-e2e-a-${run}`;
  const orgBSlug = `rls-e2e-b-${run}`;

  let orgAId: string;
  let orgBId: string;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = moduleRef.get(PrismaService);

    const regA = await request(app.getHttpServer()).post("/auth/register-organization").send({
      organizationName: "RLS E2E Org A",
      slug: orgASlug,
      adminEmail: orgAEmail,
      adminFirstName: "Ada",
      adminLastName: "Admin",
      password: "correct-horse-battery-staple",
    });
    orgAId = regA.body.organization.id;
    tokenA = regA.body.accessToken;

    const regB = await request(app.getHttpServer()).post("/auth/register-organization").send({
      organizationName: "RLS E2E Org B",
      slug: orgBSlug,
      adminEmail: orgBEmail,
      adminFirstName: "Bea",
      adminLastName: "Admin",
      password: "correct-horse-battery-staple",
    });
    orgBId = regB.body.organization.id;
    tokenB = regB.body.accessToken;
  });

  afterAll(async () => {
    if (prisma) {
      // campuses and audit_logs are RLS-protected (FORCE ROW LEVEL
      // SECURITY) — deleting them without setting the tenant GUC first
      // deletes zero rows (not an error), which then breaks the
      // organizations delete below on the audit_logs FK. withTenant is
      // mandatory here, not just for app code.
      for (const orgId of [orgAId, orgBId]) {
        await prisma.withTenant(orgId, async (tx) => {
          // Staff rows first — employees reference department, so they
          // must go before the department delete further down.
          await tx.teacherProfile.deleteMany({ where: { organizationId: orgId } });
          await tx.qualification.deleteMany({ where: { organizationId: orgId } });
          await tx.employmentHistory.deleteMany({ where: { organizationId: orgId } });
          await tx.employee.deleteMany({ where: { organizationId: orgId } });
          await tx.staffType.deleteMany({ where: { organizationId: orgId } });
          await tx.designation.deleteMany({ where: { organizationId: orgId } });
          await tx.section.deleteMany({ where: { organizationId: orgId } });
          await tx.term.deleteMany({ where: { organizationId: orgId } });
          await tx.academicYear.deleteMany({ where: { organizationId: orgId } });
          // curriculumSubject/curriculum reference program, so before it.
          await tx.curriculumSubject.deleteMany({ where: { organizationId: orgId } });
          await tx.curriculum.deleteMany({ where: { organizationId: orgId } });
          await tx.subject.deleteMany({ where: { organizationId: orgId } });
          await tx.program.deleteMany({ where: { organizationId: orgId } });
          await tx.department.deleteMany({ where: { organizationId: orgId } });
          await tx.faculty.deleteMany({ where: { organizationId: orgId } });
          await tx.campus.deleteMany({ where: { organizationId: orgId } });
          await tx.auditLog.deleteMany({ where: { organizationId: orgId } });
        });
      }
      await prisma.userRole.deleteMany({ where: { user: { organizationId: { in: [orgAId, orgBId] } } } });
      await prisma.session.deleteMany({ where: { user: { organizationId: { in: [orgAId, orgBId] } } } });
      await prisma.loginEvent.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
      await prisma.user.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
      await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
    }
    await app.close();
  });

  it("rejects requests with no token", async () => {
    await request(app.getHttpServer()).get("/organizations/me").expect(401);
  });

  it("rejects requests with a garbage token", async () => {
    await request(app.getHttpServer())
      .get("/organizations/me")
      .set("Authorization", "Bearer not-a-real-token")
      .expect(401);
  });

  it("lets each org only see its own organization record", async () => {
    const asA = await request(app.getHttpServer())
      .get("/organizations/me")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    expect(asA.body.id).toBe(orgAId);

    const asB = await request(app.getHttpServer())
      .get("/organizations/me")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    expect(asB.body.id).toBe(orgBId);
  });

  it("does not leak campuses across tenants via the API (app-level scoping)", async () => {
    const created = await request(app.getHttpServer())
      .post("/organizations/me/campuses")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Org A Main Campus", code: "A1" })
      .expect(201);
    expect(created.body.organizationId).toBe(orgAId);

    const bCampuses = await request(app.getHttpServer())
      .get("/organizations/me/campuses")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    expect(bCampuses.body).toEqual([]);

    const aCampuses = await request(app.getHttpServer())
      .get("/organizations/me/campuses")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    expect(aCampuses.body).toHaveLength(1);
    expect(aCampuses.body[0].code).toBe("A1");
  });

  it("blocks cross-tenant reads and writes at the database layer even without an app-level WHERE clause (RLS)", async () => {
    // A second, unfiltered query scoped only by the RLS session GUC —
    // proves the database itself enforces isolation, independent of
    // OrganizationsService's WHERE organizationId = ... clause.
    const rowsVisibleToA = await prisma.withTenant(orgAId, (tx) => tx.campus.findMany());
    expect(rowsVisibleToA.every((c) => c.organizationId === orgAId)).toBe(true);
    expect(rowsVisibleToA.some((c) => c.organizationId === orgBId)).toBe(false);

    const orgACampus = rowsVisibleToA[0];
    expect(orgACampus).toBeDefined();

    const directIdReadFromB = await prisma.withTenant(orgBId, (tx) =>
      tx.campus.findUnique({ where: { id: orgACampus.id } }),
    );
    expect(directIdReadFromB).toBeNull();

    await expect(
      prisma.withTenant(orgBId, (tx) =>
        tx.campus.create({
          data: { organizationId: orgAId, name: "Sneaky cross-tenant write", code: "X1" },
        }),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  describe("org hierarchy (faculty → department → program → year → term → section)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    it("builds the whole chain for org A and each step is scoped to it", async () => {
      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(tokenA))
        .send({ name: "Chain Campus", code: "CHAIN" })
        .expect(201);

      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(tokenA))
        .send({ campusId: campus.body.id, name: "Faculty", code: "FAC" })
        .expect(201);
      expect(faculty.body.organizationId).toBe(orgAId);

      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(tokenA))
        .send({ facultyId: faculty.body.id, name: "Department", code: "DEP" })
        .expect(201);

      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(tokenA))
        .send({ departmentId: department.body.id, name: "Program", code: "PROG" })
        .expect(201);

      const year = await request(app.getHttpServer())
        .post("/organizations/me/academic-years")
        .set(...auth(tokenA))
        .send({ name: "2099-2100", startDate: "2099-08-01", endDate: "2100-06-30" })
        .expect(201);

      const term = await request(app.getHttpServer())
        .post("/organizations/me/terms")
        .set(...auth(tokenA))
        .send({
          academicYearId: year.body.id,
          name: "Term",
          code: "T1",
          sequence: 1,
          startDate: "2099-08-01",
          endDate: "2099-12-15",
        })
        .expect(201);

      const section = await request(app.getHttpServer())
        .post("/organizations/me/sections")
        .set(...auth(tokenA))
        .send({ programId: program.body.id, termId: term.body.id, name: "Section", code: "A" })
        .expect(201);
      expect(section.body.organizationId).toBe(orgAId);

      // Org B sees none of it via list endpoints.
      for (const path of ["faculties", "departments", "programs", "academic-years", "terms", "sections"]) {
        const res = await request(app.getHttpServer())
          .get(`/organizations/me/${path}`)
          .set(...auth(tokenB))
          .expect(200);
        expect(res.body).toEqual([]);
      }
    });

    it("rejects creating a child under another tenant's parent, even with a well-formed id (404, not a silent cross-tenant link)", async () => {
      const campusA = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(tokenA))
        .send({ name: "Guard Campus", code: "GUARD" })
        .expect(201);

      await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(tokenB))
        .send({ campusId: campusA.body.id, name: "Sneaky Faculty", code: "SNEAK" })
        .expect(404);
    });
  });

  describe("staff (staff type → designation → employee → employment history/qualifications/teacher profile)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    it("builds an employee for org A and each step is scoped to it", async () => {
      const staffType = await request(app.getHttpServer())
        .post("/organizations/me/staff-types")
        .set(...auth(tokenA))
        .send({ name: "Teaching", code: "TEACH" })
        .expect(201);

      const designation = await request(app.getHttpServer())
        .post("/organizations/me/designations")
        .set(...auth(tokenA))
        .send({ name: "Teacher", code: "TCHR" })
        .expect(201);

      const employee = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(tokenA))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: "EMP-001",
          firstName: "Grace",
          lastName: "Hopper",
          email: "grace@staff-e2e.test",
          dateOfJoining: "2026-01-01",
        })
        .expect(201);
      expect(employee.body.organizationId).toBe(orgAId);

      const history = await request(app.getHttpServer())
        .post(`/organizations/me/employees/${employee.body.id}/employment-history`)
        .set(...auth(tokenA))
        .send({ designationId: designation.body.id, startDate: "2026-01-01" })
        .expect(201);
      expect(history.body.employeeId).toBe(employee.body.id);

      await request(app.getHttpServer())
        .post(`/organizations/me/employees/${employee.body.id}/qualifications`)
        .set(...auth(tokenA))
        .send({ degree: "PhD Mathematics", institution: "Yale" })
        .expect(201);

      const profile = await request(app.getHttpServer())
        .put(`/organizations/me/employees/${employee.body.id}/teacher-profile`)
        .set(...auth(tokenA))
        .send({ specialization: "Compilers" })
        .expect(200);
      expect(profile.body.specialization).toBe("Compilers");

      // Org B sees none of it via list endpoints.
      for (const path of ["staff-types", "designations", "employees"]) {
        const res = await request(app.getHttpServer())
          .get(`/organizations/me/${path}`)
          .set(...auth(tokenB))
          .expect(200);
        expect(res.body).toEqual([]);
      }

      // Org B can't reach into org A's employee sub-resources by id either.
      await request(app.getHttpServer())
        .get(`/organizations/me/employees/${employee.body.id}/employment-history`)
        .set(...auth(tokenB))
        .expect(404);
    });

    it("rejects creating an employee under another tenant's staff type/designation (404)", async () => {
      const staffTypeA = await request(app.getHttpServer())
        .post("/organizations/me/staff-types")
        .set(...auth(tokenA))
        .send({ name: "Guard Type", code: "GTYPE" })
        .expect(201);
      const designationA = await request(app.getHttpServer())
        .post("/organizations/me/designations")
        .set(...auth(tokenA))
        .send({ name: "Guard Designation", code: "GDESIG" })
        .expect(201);

      await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(tokenB))
        .send({
          staffTypeId: staffTypeA.body.id,
          designationId: designationA.body.id,
          employeeCode: "SNEAK-001",
          firstName: "Sneaky",
          lastName: "Employee",
          email: "sneaky@staff-e2e.test",
          dateOfJoining: "2026-01-01",
        })
        .expect(404);
    });
  });

  describe("academics (subject → curriculum → curriculum_subject)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    it("builds a curriculum with subjects for org A and each step is scoped to it", async () => {
      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(tokenA))
        .send({ name: "Academics Campus", code: "ACAD" })
        .expect(201);
      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(tokenA))
        .send({ campusId: campus.body.id, name: "Academics Faculty", code: "ACADFAC" })
        .expect(201);
      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(tokenA))
        .send({ facultyId: faculty.body.id, name: "Academics Dept", code: "ACADDEP" })
        .expect(201);
      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(tokenA))
        .send({ departmentId: department.body.id, name: "Test Program", code: "TESTPROG" })
        .expect(201);

      const subject = await request(app.getHttpServer())
        .post("/organizations/me/subjects")
        .set(...auth(tokenA))
        .send({ name: "Mathematics", code: "MATH" })
        .expect(201);
      expect(subject.body.organizationId).toBe(orgAId);

      const curriculum = await request(app.getHttpServer())
        .post("/organizations/me/curricula")
        .set(...auth(tokenA))
        .send({ programId: program.body.id, name: "Option 1", code: "OPT1" })
        .expect(201);

      const attached = await request(app.getHttpServer())
        .post(`/organizations/me/curricula/${curriculum.body.id}/subjects`)
        .set(...auth(tokenA))
        .send({ subjectId: subject.body.id, isCompulsory: true })
        .expect(201);
      expect(attached.body.curriculumId).toBe(curriculum.body.id);

      const listedA = await request(app.getHttpServer())
        .get("/organizations/me/curricula")
        .set(...auth(tokenA))
        .expect(200);
      expect(listedA.body).toHaveLength(1);
      expect(listedA.body[0].subjects).toHaveLength(1);
      expect(listedA.body[0].subjects[0].subject.code).toBe("MATH");

      for (const path of ["subjects", "curricula"]) {
        const res = await request(app.getHttpServer())
          .get(`/organizations/me/${path}`)
          .set(...auth(tokenB))
          .expect(200);
        expect(res.body).toEqual([]);
      }
    });

    it("rejects attaching a subject to another tenant's curriculum, and creating a curriculum under another tenant's program (404)", async () => {
      const campusA = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(tokenA))
        .send({ name: "Guard Academics Campus", code: "GACAD" })
        .expect(201);
      const facultyA = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(tokenA))
        .send({ campusId: campusA.body.id, name: "Guard Faculty", code: "GFAC2" })
        .expect(201);
      const departmentA = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(tokenA))
        .send({ facultyId: facultyA.body.id, name: "Guard Dept", code: "GDEP2" })
        .expect(201);
      const programA = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(tokenA))
        .send({ departmentId: departmentA.body.id, name: "Guard Program", code: "GPROG" })
        .expect(201);
      const curriculumA = await request(app.getHttpServer())
        .post("/organizations/me/curricula")
        .set(...auth(tokenA))
        .send({ programId: programA.body.id, name: "Guard Curriculum", code: "GCURR" })
        .expect(201);

      await request(app.getHttpServer())
        .post("/organizations/me/curricula")
        .set(...auth(tokenB))
        .send({ programId: programA.body.id, name: "Sneaky Curriculum", code: "SNEAKC" })
        .expect(404);

      const subjectB = await request(app.getHttpServer())
        .post("/organizations/me/subjects")
        .set(...auth(tokenB))
        .send({ name: "Sneaky Subject", code: "SNEAKS" })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/organizations/me/curricula/${curriculumA.body.id}/subjects`)
        .set(...auth(tokenB))
        .send({ subjectId: subjectB.body.id })
        .expect(404);
    });
  });
});
