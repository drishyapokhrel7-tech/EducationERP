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
      // One withTenant call per table, not one giant transaction for all
      // of them — the table list has grown across slices to the point
      // where a single interactive transaction doing every delete
      // sequentially blew Prisma's default 5s transaction timeout. Each
      // call here is its own short transaction; order still matters
      // (children before the parents they reference).
      const deleteOrder: string[] = [
        // classSchedule references teachingAssignment/room/period/section/
        // teacher(employee)/term, and teachingAssignment references
        // employee/subject/section/term — both must go before every one
        // of those parent tables, so they lead the whole list.
        "classSchedule",
        "teachingAssignment",
        "teacherProfile",
        "qualification",
        "employmentHistory",
        "employee",
        "staffType",
        "designation",
        // admission_applications.enrolledStudentId FKs to Student, so
        // these must go before the student delete.
        "admissionStatusHistory",
        "admissionApplication",
        "studentStatusHistory",
        "studentEnrollment",
        "studentGuardian",
        "student",
        "guardian",
        "section",
        "term",
        "academicYear",
        "curriculumSubject",
        "curriculum",
        "subject",
        "program",
        "department",
        "faculty",
        "room",
        "period",
        "campus",
        "auditLog",
      ];
      for (const orgId of [orgAId, orgBId]) {
        for (const model of deleteOrder) {
          await prisma.withTenant(orgId, (tx) =>
            (tx as unknown as Record<string, { deleteMany: (args: unknown) => Promise<unknown> }>)[
              model
            ].deleteMany({
              where: { organizationId: orgId },
            }),
          );
        }
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

  describe("students (student → guardian → enrollment → status history)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    async function buildEnrollmentTarget(token: string, suffix: string) {
      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(token))
        .send({ name: `Student Campus ${suffix}`, code: `SCAMP${suffix}` })
        .expect(201);
      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(token))
        .send({ campusId: campus.body.id, name: `Student Faculty ${suffix}`, code: `SFAC${suffix}` })
        .expect(201);
      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(token))
        .send({ facultyId: faculty.body.id, name: `Student Dept ${suffix}`, code: `SDEP${suffix}` })
        .expect(201);
      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(token))
        .send({ departmentId: department.body.id, name: `Student Program ${suffix}`, code: `SPROG${suffix}` })
        .expect(201);
      const year = await request(app.getHttpServer())
        .post("/organizations/me/academic-years")
        .set(...auth(token))
        .send({ name: `${suffix} Year`, startDate: "2099-08-01", endDate: "2100-06-30" })
        .expect(201);
      const term = await request(app.getHttpServer())
        .post("/organizations/me/terms")
        .set(...auth(token))
        .send({
          academicYearId: year.body.id,
          name: `Term ${suffix}`,
          code: `T${suffix}`,
          sequence: 1,
          startDate: "2099-08-01",
          endDate: "2099-12-15",
        })
        .expect(201);
      const section = await request(app.getHttpServer())
        .post("/organizations/me/sections")
        .set(...auth(token))
        .send({ programId: program.body.id, termId: term.body.id, name: `Section ${suffix}`, code: `S${suffix}` })
        .expect(201);
      return { programId: program.body.id, sectionId: section.body.id, termId: term.body.id };
    }

    it("builds a student with a guardian and enrollment for org A, scoped to it", async () => {
      const target = await buildEnrollmentTarget(tokenA, "STUA");

      const student = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: "STU-001", firstName: "Ada", lastName: "Lovelace", dateOfBirth: "2015-01-01" })
        .expect(201);
      expect(student.body.organizationId).toBe(orgAId);

      const guardian = await request(app.getHttpServer())
        .post("/organizations/me/guardians")
        .set(...auth(tokenA))
        .send({ firstName: "Grace", lastName: "Hopper", phone: "555-0100" })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/organizations/me/students/${student.body.id}/guardians`)
        .set(...auth(tokenA))
        .send({ guardianId: guardian.body.id, relationship: "Mother", isPrimaryContact: true })
        .expect(201);

      const enrollment = await request(app.getHttpServer())
        .post(`/organizations/me/students/${student.body.id}/enrollments`)
        .set(...auth(tokenA))
        .send({ ...target, enrollmentDate: "2099-08-01" })
        .expect(201);
      expect(enrollment.body.studentId).toBe(student.body.id);

      const statusChange = await request(app.getHttpServer())
        .put(`/organizations/me/students/${student.body.id}/status`)
        .set(...auth(tokenA))
        .send({ status: "WITHDRAWN", reason: "Relocated", effectiveDate: "2099-09-01" })
        .expect(200);
      expect(statusChange.body.status).toBe("WITHDRAWN");

      for (const path of ["students", "guardians"]) {
        const res = await request(app.getHttpServer())
          .get(`/organizations/me/${path}`)
          .set(...auth(tokenB))
          .expect(200);
        expect(res.body).toEqual([]);
      }

      await request(app.getHttpServer())
        .get(`/organizations/me/students/${student.body.id}/enrollments`)
        .set(...auth(tokenB))
        .expect(404);
    });

    it("rejects enrolling a student under another tenant's program/section/term (404)", async () => {
      const target = await buildEnrollmentTarget(tokenA, "GUARD");

      const studentB = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenB))
        .send({ studentCode: "SNEAK-001", firstName: "Sneaky", lastName: "Student", dateOfBirth: "2015-01-01" })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/organizations/me/students/${studentB.body.id}/enrollments`)
        .set(...auth(tokenB))
        .send({ ...target, enrollmentDate: "2099-08-01" })
        .expect(404);

      const guardianA = await request(app.getHttpServer())
        .post("/organizations/me/guardians")
        .set(...auth(tokenA))
        .send({ firstName: "Guard", lastName: "Ian", phone: "555-0199" })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/organizations/me/students/${studentB.body.id}/guardians`)
        .set(...auth(tokenA))
        .send({ guardianId: guardianA.body.id, relationship: "Guardian" })
        .expect(404);
    });
  });

  describe("admissions (application → status review → enroll)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    async function buildEnrollmentTarget(token: string, suffix: string) {
      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(token))
        .send({ name: `Admission Campus ${suffix}`, code: `ACAMP${suffix}` })
        .expect(201);
      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(token))
        .send({ campusId: campus.body.id, name: `Admission Faculty ${suffix}`, code: `AFAC${suffix}` })
        .expect(201);
      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(token))
        .send({ facultyId: faculty.body.id, name: `Admission Dept ${suffix}`, code: `ADEP${suffix}` })
        .expect(201);
      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(token))
        .send({ departmentId: department.body.id, name: `Admission Program ${suffix}`, code: `APROG${suffix}` })
        .expect(201);
      const year = await request(app.getHttpServer())
        .post("/organizations/me/academic-years")
        .set(...auth(token))
        .send({ name: `Admission Year ${suffix}`, startDate: "2099-08-01", endDate: "2100-06-30" })
        .expect(201);
      const term = await request(app.getHttpServer())
        .post("/organizations/me/terms")
        .set(...auth(token))
        .send({
          academicYearId: year.body.id,
          name: `Admission Term ${suffix}`,
          code: `AT${suffix}`,
          sequence: 1,
          startDate: "2099-08-01",
          endDate: "2099-12-15",
        })
        .expect(201);
      const section = await request(app.getHttpServer())
        .post("/organizations/me/sections")
        .set(...auth(token))
        .send({ programId: program.body.id, termId: term.body.id, name: `Admission Section ${suffix}`, code: `AS${suffix}` })
        .expect(201);
      return { programId: program.body.id, sectionId: section.body.id, termId: term.body.id };
    }

    it("takes an application from submission through approval to a real enrollment, scoped to org A", async () => {
      const target = await buildEnrollmentTarget(tokenA, "ADMA");

      const application = await request(app.getHttpServer())
        .post("/organizations/me/admission-applications")
        .set(...auth(tokenA))
        .send({
          programId: target.programId,
          applicantFirstName: "Marie",
          applicantLastName: "Curie",
          dateOfBirth: "2015-11-07",
          guardianName: "Pierre Curie",
          guardianPhone: "555-0200",
          appliedDate: "2099-01-01",
          score: 92,
        })
        .expect(201);
      expect(application.body.organizationId).toBe(orgAId);
      expect(application.body.status).toBe("SUBMITTED");

      await request(app.getHttpServer())
        .put(`/organizations/me/admission-applications/${application.body.id}/status`)
        .set(...auth(tokenA))
        .send({ status: "UNDER_REVIEW", effectiveDate: "2099-01-02" })
        .expect(200);

      await request(app.getHttpServer())
        .put(`/organizations/me/admission-applications/${application.body.id}/status`)
        .set(...auth(tokenA))
        .send({ status: "APPROVED", effectiveDate: "2099-01-05" })
        .expect(200);

      // Enrolling before APPROVED-only precondition would be violated is
      // not tested separately here — this application is already
      // APPROVED at this point — so instead verify the *other* business
      // rule: a non-approved application can't be enrolled (use a second
      // application still at SUBMITTED).
      const notApproved = await request(app.getHttpServer())
        .post("/organizations/me/admission-applications")
        .set(...auth(tokenA))
        .send({
          programId: target.programId,
          applicantFirstName: "Not",
          applicantLastName: "Approved",
          dateOfBirth: "2015-01-01",
          appliedDate: "2099-01-01",
        })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/admission-applications/${notApproved.body.id}/enroll`)
        .set(...auth(tokenA))
        .send({ studentCode: "SHOULD-FAIL", sectionId: target.sectionId, termId: target.termId, enrollmentDate: "2099-08-01" })
        .expect(400);

      const student = await request(app.getHttpServer())
        .post(`/organizations/me/admission-applications/${application.body.id}/enroll`)
        .set(...auth(tokenA))
        .send({
          studentCode: "ADM-STU-001",
          sectionId: target.sectionId,
          termId: target.termId,
          enrollmentDate: "2099-08-01",
        })
        .expect(201);
      expect(student.body.organizationId).toBe(orgAId);
      expect(student.body.firstName).toBe("Marie");

      // Guardian carried over from the application.
      const students = await request(app.getHttpServer())
        .get("/organizations/me/students")
        .set(...auth(tokenA))
        .expect(200);
      const enrolled = students.body.find((s: { id: string }) => s.id === student.body.id);
      expect(enrolled.guardians).toHaveLength(1);
      expect(enrolled.guardians[0].guardian.firstName).toBe("Pierre");

      // Enrolling the same application twice is rejected.
      await request(app.getHttpServer())
        .post(`/organizations/me/admission-applications/${application.body.id}/enroll`)
        .set(...auth(tokenA))
        .send({ studentCode: "ADM-STU-002", sectionId: target.sectionId, termId: target.termId, enrollmentDate: "2099-08-01" })
        .expect(400);

      const listB = await request(app.getHttpServer())
        .get("/organizations/me/admission-applications")
        .set(...auth(tokenB))
        .expect(200);
      expect(listB.body).toEqual([]);
    });

    it("rejects creating an application under another tenant's program, and enrolling under another tenant's section/term (404)", async () => {
      const target = await buildEnrollmentTarget(tokenA, "ADMGUARD");

      await request(app.getHttpServer())
        .post("/organizations/me/admission-applications")
        .set(...auth(tokenB))
        .send({
          programId: target.programId,
          applicantFirstName: "Sneaky",
          applicantLastName: "Applicant",
          dateOfBirth: "2015-01-01",
          appliedDate: "2099-01-01",
        })
        .expect(404);

      const targetB = await buildEnrollmentTarget(tokenB, "ADMGUARDB");
      const applicationB = await request(app.getHttpServer())
        .post("/organizations/me/admission-applications")
        .set(...auth(tokenB))
        .send({
          programId: targetB.programId,
          applicantFirstName: "Real",
          applicantLastName: "ApplicantB",
          dateOfBirth: "2015-01-01",
          appliedDate: "2099-01-01",
        })
        .expect(201);
      await request(app.getHttpServer())
        .put(`/organizations/me/admission-applications/${applicationB.body.id}/status`)
        .set(...auth(tokenB))
        .send({ status: "APPROVED", effectiveDate: "2099-01-05" })
        .expect(200);

      await request(app.getHttpServer())
        .post(`/organizations/me/admission-applications/${applicationB.body.id}/enroll`)
        .set(...auth(tokenB))
        .send({
          studentCode: "SNEAK-ENROLL",
          sectionId: target.sectionId,
          termId: target.termId,
          enrollmentDate: "2099-08-01",
        })
        .expect(404);
    });
  });

  describe("student import/export (CSV)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    it("imports valid rows, reports invalid/duplicate rows without failing the batch, and stays tenant-scoped", async () => {
      const csv = [
        "studentCode,firstName,lastName,dateOfBirth,gender",
        "IMP-001,Rosalind,Franklin,2015-02-01,Female",
        "IMP-002,Alan,Turing,2015-03-01,Male",
        // missing lastName -> reported error, not created
        "IMP-003,NoLastName,,2015-04-01,",
        // duplicate of IMP-001 within the same file -> reported error
        "IMP-001,Dup,Licate,2015-02-01,Female",
      ].join("\n");

      const res = await request(app.getHttpServer())
        .post("/organizations/me/students/import")
        .set(...auth(tokenA))
        .attach("file", Buffer.from(csv), "students.csv")
        .expect(201);

      expect(res.body.totalRows).toBe(4);
      expect(res.body.created).toBe(2);
      expect(res.body.errors).toHaveLength(2);
      expect(res.body.errors.map((e: { row: number }) => e.row).sort()).toEqual([4, 5]);

      // Re-importing the same two valid rows now reports them as
      // already-existing duplicates rather than creating them again.
      const reimport = await request(app.getHttpServer())
        .post("/organizations/me/students/import")
        .set(...auth(tokenA))
        .attach(
          "file",
          Buffer.from("studentCode,firstName,lastName,dateOfBirth,gender\nIMP-001,Rosalind,Franklin,2015-02-01,Female"),
          "students.csv",
        )
        .expect(201);
      expect(reimport.body.created).toBe(0);
      expect(reimport.body.errors).toHaveLength(1);

      // Org B's import of the same studentCode succeeds — import is
      // tenant-scoped, not globally unique.
      const crossTenant = await request(app.getHttpServer())
        .post("/organizations/me/students/import")
        .set(...auth(tokenB))
        .attach(
          "file",
          Buffer.from("studentCode,firstName,lastName,dateOfBirth,gender\nIMP-001,Other,Org,2015-02-01,Female"),
          "students.csv",
        )
        .expect(201);
      expect(crossTenant.body.created).toBe(1);

      // Org A's export contains only its own imported students, not org B's.
      const exportA = await request(app.getHttpServer())
        .get("/organizations/me/students/export")
        .set(...auth(tokenA))
        .expect(200);
      expect(exportA.text).toContain("IMP-001,Rosalind,Franklin");
      expect(exportA.text).toContain("IMP-002,Alan,Turing");
      expect(exportA.text).not.toContain("Other,Org");

      const exportB = await request(app.getHttpServer())
        .get("/organizations/me/students/export")
        .set(...auth(tokenB))
        .expect(200);
      expect(exportB.text).toContain("IMP-001,Other,Org");
      expect(exportB.text).not.toContain("Rosalind");
    });

    it("rejects a malformed CSV file with a 400, not a 500", async () => {
      await request(app.getHttpServer())
        .post("/organizations/me/students/import")
        .set(...auth(tokenA))
        .attach("file", Buffer.from('studentCode,firstName\n"unterminated quote,x'), "bad.csv")
        .expect(400);
    });
  });

  describe("timetable (room → period → teaching assignment → class schedule)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    async function buildTimetableTarget(token: string, suffix: string) {
      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(token))
        .send({ name: `Timetable Campus ${suffix}`, code: `TTCAMP${suffix}` })
        .expect(201);
      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(token))
        .send({ campusId: campus.body.id, name: `Timetable Faculty ${suffix}`, code: `TTFAC${suffix}` })
        .expect(201);
      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(token))
        .send({ facultyId: faculty.body.id, name: `Timetable Dept ${suffix}`, code: `TTDEP${suffix}` })
        .expect(201);
      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(token))
        .send({ departmentId: department.body.id, name: `Timetable Program ${suffix}`, code: `TTPROG${suffix}` })
        .expect(201);
      const year = await request(app.getHttpServer())
        .post("/organizations/me/academic-years")
        .set(...auth(token))
        .send({ name: `Timetable Year ${suffix}`, startDate: "2099-08-01", endDate: "2100-06-30" })
        .expect(201);
      const term = await request(app.getHttpServer())
        .post("/organizations/me/terms")
        .set(...auth(token))
        .send({
          academicYearId: year.body.id,
          name: `Timetable Term ${suffix}`,
          code: `TTT${suffix}`,
          sequence: 1,
          startDate: "2099-08-01",
          endDate: "2099-12-15",
        })
        .expect(201);
      const section = await request(app.getHttpServer())
        .post("/organizations/me/sections")
        .set(...auth(token))
        .send({ programId: program.body.id, termId: term.body.id, name: `Timetable Section ${suffix}`, code: `TS${suffix}` })
        .expect(201);
      const staffType = await request(app.getHttpServer())
        .post("/organizations/me/staff-types")
        .set(...auth(token))
        .send({ name: `Timetable Staff Type ${suffix}`, code: `TST${suffix}` })
        .expect(201);
      const designation = await request(app.getHttpServer())
        .post("/organizations/me/designations")
        .set(...auth(token))
        .send({ name: `Timetable Designation ${suffix}`, code: `TDS${suffix}` })
        .expect(201);
      const employee = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(token))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `TTEMP-${suffix}`,
          firstName: "Timetable",
          lastName: `Teacher${suffix}`,
          email: `ttteacher-${suffix}-${run}@rls-e2e.test`,
          dateOfJoining: "2026-01-01",
        })
        .expect(201);
      const subject = await request(app.getHttpServer())
        .post("/organizations/me/subjects")
        .set(...auth(token))
        .send({ name: `Timetable Subject ${suffix}`, code: `TSUB${suffix}` })
        .expect(201);
      const room = await request(app.getHttpServer())
        .post("/organizations/me/rooms")
        .set(...auth(token))
        .send({ campusId: campus.body.id, name: `Timetable Room ${suffix}`, code: `TRM${suffix}` })
        .expect(201);
      const period = await request(app.getHttpServer())
        .post("/organizations/me/periods")
        .set(...auth(token))
        .send({ name: `Period ${suffix}`, code: `TP${suffix}`, sequence: 1, startTime: "09:00", endTime: "09:45" })
        .expect(201);
      return {
        campusId: campus.body.id,
        termId: term.body.id,
        sectionId: section.body.id,
        employeeId: employee.body.id,
        subjectId: subject.body.id,
        roomId: room.body.id,
        periodId: period.body.id,
      };
    }

    it("builds a full teaching-assignment + schedule chain for org A, scoped to it", async () => {
      const t = await buildTimetableTarget(tokenA, "TTA");

      const assignment = await request(app.getHttpServer())
        .post("/organizations/me/teaching-assignments")
        .set(...auth(tokenA))
        .send({ employeeId: t.employeeId, subjectId: t.subjectId, sectionId: t.sectionId, termId: t.termId })
        .expect(201);
      expect(assignment.body.organizationId).toBe(orgAId);

      const schedule = await request(app.getHttpServer())
        .post("/organizations/me/class-schedules")
        .set(...auth(tokenA))
        .send({ teachingAssignmentId: assignment.body.id, roomId: t.roomId, periodId: t.periodId, dayOfWeek: 1 })
        .expect(201);
      expect(schedule.body.sectionId).toBe(t.sectionId);
      expect(schedule.body.teacherId).toBe(t.employeeId);

      for (const path of ["rooms", "periods", "teaching-assignments", "class-schedules"]) {
        const res = await request(app.getHttpServer())
          .get(`/organizations/me/${path}`)
          .set(...auth(tokenB))
          .expect(200);
        expect(res.body).toEqual([]);
      }
    });

    it("rejects creating a room under another tenant's campus, and a teaching assignment under another tenant's section (404)", async () => {
      const t = await buildTimetableTarget(tokenA, "TTGUARD");

      await request(app.getHttpServer())
        .post("/organizations/me/rooms")
        .set(...auth(tokenB))
        .send({ campusId: t.campusId, name: "Sneaky Room", code: "SNEAKRM" })
        .expect(404);

      await request(app.getHttpServer())
        .post("/organizations/me/teaching-assignments")
        .set(...auth(tokenB))
        .send({ employeeId: t.employeeId, subjectId: t.subjectId, sectionId: t.sectionId, termId: t.termId })
        .expect(404);
    });

    it("rejects double-booking the same room, section or teacher in one term/day/period (409)", async () => {
      const t = await buildTimetableTarget(tokenA, "TTCONF");

      const assignment = await request(app.getHttpServer())
        .post("/organizations/me/teaching-assignments")
        .set(...auth(tokenA))
        .send({ employeeId: t.employeeId, subjectId: t.subjectId, sectionId: t.sectionId, termId: t.termId })
        .expect(201);

      // Assigning the same section+subject+term a second time is rejected
      // before it ever reaches the schedule step.
      await request(app.getHttpServer())
        .post("/organizations/me/teaching-assignments")
        .set(...auth(tokenA))
        .send({ employeeId: t.employeeId, subjectId: t.subjectId, sectionId: t.sectionId, termId: t.termId })
        .expect(409);

      await request(app.getHttpServer())
        .post("/organizations/me/class-schedules")
        .set(...auth(tokenA))
        .send({ teachingAssignmentId: assignment.body.id, roomId: t.roomId, periodId: t.periodId, dayOfWeek: 2 })
        .expect(201);

      // Same room, same day/period, different section/teacher -> conflict.
      // A second independent target is the simplest way to get a
      // different section+teacher sharing the same term.
      const t2 = await buildTimetableTarget(tokenA, "TTCONF2");
      const assignment2 = await request(app.getHttpServer())
        .post("/organizations/me/teaching-assignments")
        .set(...auth(tokenA))
        .send({ employeeId: t2.employeeId, subjectId: t2.subjectId, sectionId: t2.sectionId, termId: t.termId })
        .expect(201);

      await request(app.getHttpServer())
        .post("/organizations/me/class-schedules")
        .set(...auth(tokenA))
        .send({ teachingAssignmentId: assignment2.body.id, roomId: t.roomId, periodId: t.periodId, dayOfWeek: 2 })
        .expect(409);
    });
  });
});
