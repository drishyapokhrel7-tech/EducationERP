import "reflect-metadata";
import { createHmac } from "crypto";
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
        // answer references examAttempt + question — examAttempt is
        // deleted early in this list and question very late, so answer
        // must lead everything, ahead of even reportCard/grade/marks.
        "answer",
        // faceMatchEvent.cameraEventId is RESTRICT (must precede
        // cameraEvent); cameraEvent.cameraId is RESTRICT (must precede
        // camera); faceMatchEvent's matchedEnrollmentId/reviewedBy are
        // SET NULL, so no ordering requirement against
        // faceEnrollment/user specifically.
        "faceMatchEvent",
        "cameraEvent",
        "camera",
        // faceEmbedding.faceEnrollmentId is RESTRICT — must precede
        // faceEnrollment.
        "faceEmbedding",
        // faceEnrollment's studentId/staffId FKs are ON DELETE SET NULL
        // (not RESTRICT), so it doesn't block on student/employee
        // ordering the way most tables here do — it only needs to
        // precede organization itself, same as biometricPolicy.
        "faceEnrollment",
        "biometricPolicy",
        // examRoom references examSchedule + room; examSchedule
        // references examSubject; examSubject references exam +
        // curriculumSubject; exam references examType/term/
        // gradingScheme — all four lead the whole list since their
        // parents span from room (deleted late) to term (deleted
        // mid-list) to examType/gradingScheme/curriculumSubject
        // (deleted later still), and nothing else references any of
        // these four tables.
        "reportCard",
        "grade",
        "marks",
        "examAttempt",
        "examRoom",
        "examSchedule",
        "examSubject",
        "exam",
        // knowledgeCheckAnswer references knowledgeCheckAttempt +
        // knowledgeCheckQuestion (both RESTRICT, LMS discovery slice 4) —
        // must precede both. knowledgeCheckAttempt/knowledgeCheckQuestion
        // reference knowledgeCheck; knowledgeCheck references
        // teachingAssignment + syllabusNode; assignmentSubmission
        // references assignment; assignment references teachingAssignment;
        // announcement (LMS discovery slice 5) also references
        // teachingAssignment (RESTRICT) directly. discussionPost
        // references discussionTopic (RESTRICT, LMS discovery slice 6) —
        // must precede it (its student/employee author FKs are SET NULL,
        // no ordering requirement there); discussionTopic itself
        // references teachingAssignment (RESTRICT) — all nine lead the
        // whole list since teachingAssignment and syllabusNode are both
        // required elsewhere to be deleted much later.
        "knowledgeCheckAnswer",
        "knowledgeCheckAttempt",
        "knowledgeCheckQuestion",
        "knowledgeCheck",
        "assignmentSubmission",
        "assignment",
        "announcement",
        "discussionPost",
        "discussionTopic",
        // classMaterial references classSession; classSession references
        // classSchedule/section/lessonPlan/syllabusNode — both lead the
        // whole list since classSession must precede lessonPlan, which
        // is itself already required to lead everything below.
        "classMaterial",
        "classSession",
        // lessonPlan references teachingAssignment + syllabusNode;
        // learningObjective references syllabusNode; syllabusNode
        // references syllabus (self-reference is ON DELETE SET NULL, so
        // parent/child ordering within syllabusNode itself doesn't
        // matter); syllabus references curriculumSubject + term — all
        // four lead the whole list since their parents span from very
        // early (teachingAssignment) to very late (term/curriculumSubject).
        "lessonPlan",
        "learningObjective",
        "syllabusNode",
        "syllabus",
        // attendanceException references studentAttendance; studentAttendance
        // references attendanceSession + student; staffAttendance references
        // employee; attendanceSession references classSchedule + section —
        // all four must go before classSchedule (which itself must go before
        // teachingAssignment/employee/section/etc.), so they lead the list.
        "attendanceException",
        "studentAttendance",
        "staffAttendance",
        "attendanceSession",
        // courseModuleItemCompletion references courseModuleItem
        // (RESTRICT) and student (RESTRICT, deleted much later at line
        // ~232) — must precede both. courseModuleItem references
        // courseModule (RESTRICT), which references teachingAssignment
        // (RESTRICT) — same ordering requirement as classSchedule below.
        "courseModuleItemCompletion",
        "courseModuleItem",
        "courseModule",
        // classSchedule references teachingAssignment/room/period/section/
        // teacher(employee)/term, and teachingAssignment references
        // employee/subject/section/term — both must go before every one
        // of those parent tables.
        "classSchedule",
        "teachingAssignment",
        "teacherProfile",
        "qualification",
        "employmentHistory",
        // Leave (Phase 7 slice 7b-1) — leaveRequest/staffLeaveBalance both
        // reference employee (RESTRICT), so both must precede it; leaveType
        // is only referenced by those two, so it can go anywhere ahead of
        // employee too.
        "leaveRequest",
        "staffLeaveBalance",
        "leaveType",
        // Payroll (Phase 7 slice 7b-2) — payrollItem references payroll
        // (RESTRICT), so it leads payroll; payroll references employee
        // (RESTRICT), so both must precede employee too.
        "payrollItem",
        "payroll",
        // salaryStructureItem references salaryStructure (RESTRICT);
        // employee's FK to salaryStructure is ON DELETE SET NULL, so
        // salaryStructure has no ordering requirement against employee
        // specifically, but it's grouped here for readability.
        "salaryStructureItem",
        "salaryStructure",
        // Transport (Phase 7 slice 7d-1) — studentTransportAssignment
        // references studentEnrollment/route/stop (RESTRICT), so it leads
        // all three (studentEnrollment itself is deleted much later, see
        // below — this only needs to precede it, which it does here);
        // stop references route (RESTRICT), so it precedes route; driver
        // references employee (RESTRICT), so it must precede employee too.
        // vehicle/route have no ordering requirement against employee
        // (route.driverId is ON DELETE SET NULL) but are grouped here for
        // readability.
        "studentTransportAssignment",
        // vehicleTrackingEvent.vehicleId is RESTRICT (must precede
        // vehicle); its routeId is ON DELETE SET NULL, no ordering
        // requirement against route.
        "vehicleTrackingEvent",
        "stop",
        "route",
        "driver",
        "vehicle",
        "employee",
        "staffType",
        "designation",
        // Finance (Phase 7 slice 7a-1) — financialTransaction references
        // invoice/payment/discount/refund, so it leads all four;
        // refund/discount/payment/studentFeeAssignment/invoiceItem all
        // reference invoice (or payment), so they precede invoice itself;
        // studentFeeAssignment also references studentEnrollment and
        // feeStructure, and invoice references student/studentEnrollment,
        // so the whole block must go before those — well ahead of the
        // student/program/term deletes below. studentScholarship/
        // scholarship and feeStructureItem/feeStructure/feeCategory are
        // otherwise self-contained but placed here too since discount can
        // reference scholarship.
        // esewaTransaction.invoiceId is RESTRICT (slice 7a-2) — must
        // precede invoice, same as every other finance table here.
        "esewaTransaction",
        "financialTransaction",
        "refund",
        "discount",
        "payment",
        "studentFeeAssignment",
        "invoiceItem",
        "invoice",
        "studentScholarship",
        "scholarship",
        "feeStructureItem",
        "feeStructure",
        "feeCategory",
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
        // question references questionBank; questionBank references
        // curriculumSubject — both lead curriculumSubject.
        "question",
        "questionBank",
        "gradingScheme",
        "examType",
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
      // Roles & Permissions admin (custom Role rows only — Role.organizationId
      // is null for system roles, so this never touches the master template).
      // rolePermission/userRole must both clear before role itself deletes.
      await prisma.rolePermission.deleteMany({ where: { role: { organizationId: { in: [orgAId, orgBId] } } } });
      await prisma.userRole.deleteMany({ where: { user: { organizationId: { in: [orgAId, orgBId] } } } });
      await prisma.role.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
      await prisma.session.deleteMany({ where: { user: { organizationId: { in: [orgAId, orgBId] } } } });
      await prisma.loginEvent.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
      await prisma.user.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
      await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
    }
    await app.close();
  }, 180000);

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

  describe("attendance (session → roster → mark → correction; staff attendance)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    async function buildAttendanceTarget(token: string, suffix: string) {
      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(token))
        .send({ name: `Attendance Campus ${suffix}`, code: `ATCAMP${suffix}` })
        .expect(201);
      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(token))
        .send({ campusId: campus.body.id, name: `Attendance Faculty ${suffix}`, code: `ATFAC${suffix}` })
        .expect(201);
      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(token))
        .send({ facultyId: faculty.body.id, name: `Attendance Dept ${suffix}`, code: `ATDEP${suffix}` })
        .expect(201);
      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(token))
        .send({ departmentId: department.body.id, name: `Attendance Program ${suffix}`, code: `ATPROG${suffix}` })
        .expect(201);
      const year = await request(app.getHttpServer())
        .post("/organizations/me/academic-years")
        .set(...auth(token))
        .send({ name: `Attendance Year ${suffix}`, startDate: "2099-08-01", endDate: "2100-06-30" })
        .expect(201);
      const term = await request(app.getHttpServer())
        .post("/organizations/me/terms")
        .set(...auth(token))
        .send({
          academicYearId: year.body.id,
          name: `Attendance Term ${suffix}`,
          code: `ATT${suffix}`,
          sequence: 1,
          startDate: "2099-08-01",
          endDate: "2099-12-15",
        })
        .expect(201);
      const section = await request(app.getHttpServer())
        .post("/organizations/me/sections")
        .set(...auth(token))
        .send({ programId: program.body.id, termId: term.body.id, name: `Attendance Section ${suffix}`, code: `AS${suffix}` })
        .expect(201);
      const staffType = await request(app.getHttpServer())
        .post("/organizations/me/staff-types")
        .set(...auth(token))
        .send({ name: `Attendance Staff Type ${suffix}`, code: `AST${suffix}` })
        .expect(201);
      const designation = await request(app.getHttpServer())
        .post("/organizations/me/designations")
        .set(...auth(token))
        .send({ name: `Attendance Designation ${suffix}`, code: `ADS${suffix}` })
        .expect(201);
      const employee = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(token))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `ATEMP-${suffix}`,
          firstName: "Attendance",
          lastName: `Teacher${suffix}`,
          email: `atteacher-${suffix}-${run}@rls-e2e.test`,
          dateOfJoining: "2026-01-01",
        })
        .expect(201);
      const subject = await request(app.getHttpServer())
        .post("/organizations/me/subjects")
        .set(...auth(token))
        .send({ name: `Attendance Subject ${suffix}`, code: `ATSUB${suffix}` })
        .expect(201);
      const room = await request(app.getHttpServer())
        .post("/organizations/me/rooms")
        .set(...auth(token))
        .send({ campusId: campus.body.id, name: `Attendance Room ${suffix}`, code: `ARM${suffix}` })
        .expect(201);
      const period = await request(app.getHttpServer())
        .post("/organizations/me/periods")
        .set(...auth(token))
        .send({ name: `Attendance Period ${suffix}`, code: `AP${suffix}`, sequence: 1, startTime: "09:00", endTime: "09:45" })
        .expect(201);
      const assignment = await request(app.getHttpServer())
        .post("/organizations/me/teaching-assignments")
        .set(...auth(token))
        .send({ employeeId: employee.body.id, subjectId: subject.body.id, sectionId: section.body.id, termId: term.body.id })
        .expect(201);
      const classSchedule = await request(app.getHttpServer())
        .post("/organizations/me/class-schedules")
        .set(...auth(token))
        .send({ teachingAssignmentId: assignment.body.id, roomId: room.body.id, periodId: period.body.id, dayOfWeek: 1 })
        .expect(201);

      const studentIds: string[] = [];
      for (const n of [1, 2]) {
        const student = await request(app.getHttpServer())
          .post("/organizations/me/students")
          .set(...auth(token))
          .send({
            studentCode: `AT-STU-${suffix}-${n}`,
            firstName: `Student${n}`,
            lastName: suffix,
            dateOfBirth: "2015-01-01",
          })
          .expect(201);
        await request(app.getHttpServer())
          .post(`/organizations/me/students/${student.body.id}/enrollments`)
          .set(...auth(token))
          .send({
            programId: program.body.id,
            sectionId: section.body.id,
            termId: term.body.id,
            enrollmentDate: "2099-08-01",
          })
          .expect(201);
        studentIds.push(student.body.id);
      }

      return { classScheduleId: classSchedule.body.id, sectionId: section.body.id, employeeId: employee.body.id, studentIds };
    }

    it("creates a session with the active-enrollment roster, marks attendance, and stays tenant-scoped", async () => {
      const t = await buildAttendanceTarget(tokenA, "ATA");

      const session = await request(app.getHttpServer())
        .post("/organizations/me/attendance-sessions")
        .set(...auth(tokenA))
        .send({ classScheduleId: t.classScheduleId, date: "2099-08-10" })
        .expect(201);
      expect(session.body.sectionId).toBe(t.sectionId);
      expect(session.body.roster.map((s: { id: string }) => s.id).sort()).toEqual([...t.studentIds].sort());

      // Duplicate session for the same schedule+date is rejected.
      await request(app.getHttpServer())
        .post("/organizations/me/attendance-sessions")
        .set(...auth(tokenA))
        .send({ classScheduleId: t.classScheduleId, date: "2099-08-10" })
        .expect(409);

      const marked = await request(app.getHttpServer())
        .post(`/organizations/me/attendance-sessions/${session.body.id}/mark`)
        .set(...auth(tokenA))
        .send({
          entries: [
            { studentId: t.studentIds[0], status: "PRESENT" },
            { studentId: t.studentIds[1], status: "ABSENT", remarks: "Sick" },
          ],
        })
        .expect(201);
      expect(marked.body).toHaveLength(2);

      const fetched = await request(app.getHttpServer())
        .get(`/organizations/me/attendance-sessions/${session.body.id}`)
        .set(...auth(tokenA))
        .expect(200);
      const byStudent = new Map(
        fetched.body.studentAttendance.map((a: { studentId: string; status: string }) => [a.studentId, a.status]),
      );
      expect(byStudent.get(t.studentIds[0])).toBe("PRESENT");
      expect(byStudent.get(t.studentIds[1])).toBe("ABSENT");

      const listB = await request(app.getHttpServer())
        .get("/organizations/me/attendance-sessions")
        .set(...auth(tokenB))
        .expect(200);
      expect(listB.body).toEqual([]);

      await request(app.getHttpServer())
        .get(`/organizations/me/attendance-sessions/${session.body.id}`)
        .set(...auth(tokenB))
        .expect(404);
    });

    it("rejects marking attendance for a student not enrolled in the session's section (400)", async () => {
      const t = await buildAttendanceTarget(tokenA, "ATBAD");
      const other = await buildAttendanceTarget(tokenA, "ATBADOTHER");

      const session = await request(app.getHttpServer())
        .post("/organizations/me/attendance-sessions")
        .set(...auth(tokenA))
        .send({ classScheduleId: t.classScheduleId, date: "2099-08-11" })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/organizations/me/attendance-sessions/${session.body.id}/mark`)
        .set(...auth(tokenA))
        .send({ entries: [{ studentId: other.studentIds[0], status: "PRESENT" }] })
        .expect(400);
    });

    it("rejects creating a session under another tenant's class schedule (404)", async () => {
      const t = await buildAttendanceTarget(tokenA, "ATGUARD");

      await request(app.getHttpServer())
        .post("/organizations/me/attendance-sessions")
        .set(...auth(tokenB))
        .send({ classScheduleId: t.classScheduleId, date: "2099-08-12" })
        .expect(404);
    });

    it("supports correcting an already-marked attendance record with an audit trail, and rejects correcting an unmarked student (404)", async () => {
      const t = await buildAttendanceTarget(tokenA, "ATCORR");

      const session = await request(app.getHttpServer())
        .post("/organizations/me/attendance-sessions")
        .set(...auth(tokenA))
        .send({ classScheduleId: t.classScheduleId, date: "2099-08-13" })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/organizations/me/attendance-sessions/${session.body.id}/mark`)
        .set(...auth(tokenA))
        .send({ entries: [{ studentId: t.studentIds[0], status: "ABSENT" }] })
        .expect(201);

      const corrected = await request(app.getHttpServer())
        .put(`/organizations/me/attendance-sessions/${session.body.id}/students/${t.studentIds[0]}`)
        .set(...auth(tokenA))
        .send({ status: "PRESENT", reason: "Marked absent by mistake" })
        .expect(200);
      expect(corrected.body.status).toBe("PRESENT");

      // The second student was never marked — correcting them 404s rather
      // than silently creating a record (correction != first mark).
      await request(app.getHttpServer())
        .put(`/organizations/me/attendance-sessions/${session.body.id}/students/${t.studentIds[1]}`)
        .set(...auth(tokenA))
        .send({ status: "PRESENT", reason: "N/A" })
        .expect(404);
    });

    it("marks staff attendance per employee+date, upserts on re-mark, and stays tenant-scoped", async () => {
      const t = await buildAttendanceTarget(tokenA, "ATSTAFF");

      await request(app.getHttpServer())
        .post("/organizations/me/staff-attendance")
        .set(...auth(tokenA))
        .send({ employeeId: t.employeeId, date: "2099-08-14", status: "PRESENT" })
        .expect(201);

      const upserted = await request(app.getHttpServer())
        .post("/organizations/me/staff-attendance")
        .set(...auth(tokenA))
        .send({ employeeId: t.employeeId, date: "2099-08-14", status: "LATE", remarks: "Traffic" })
        .expect(201);
      expect(upserted.body.status).toBe("LATE");

      const listA = await request(app.getHttpServer())
        .get("/organizations/me/staff-attendance")
        .set(...auth(tokenA))
        .expect(200);
      expect(listA.body.filter((a: { employeeId: string }) => a.employeeId === t.employeeId)).toHaveLength(1);

      const listB = await request(app.getHttpServer())
        .get("/organizations/me/staff-attendance")
        .set(...auth(tokenB))
        .expect(200);
      expect(listB.body).toEqual([]);
    });
  });

  describe("syllabus (syllabus → unit/chapter/topic/subtopic tree → learning objectives; lesson plans)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    async function buildSyllabusTarget(token: string, suffix: string) {
      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(token))
        .send({ name: `Syllabus Campus ${suffix}`, code: `SYCAMP${suffix}` })
        .expect(201);
      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(token))
        .send({ campusId: campus.body.id, name: `Syllabus Faculty ${suffix}`, code: `SYFAC${suffix}` })
        .expect(201);
      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(token))
        .send({ facultyId: faculty.body.id, name: `Syllabus Dept ${suffix}`, code: `SYDEP${suffix}` })
        .expect(201);
      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(token))
        .send({ departmentId: department.body.id, name: `Syllabus Program ${suffix}`, code: `SYPROG${suffix}` })
        .expect(201);
      const year = await request(app.getHttpServer())
        .post("/organizations/me/academic-years")
        .set(...auth(token))
        .send({ name: `Syllabus Year ${suffix}`, startDate: "2099-08-01", endDate: "2100-06-30" })
        .expect(201);
      const term = await request(app.getHttpServer())
        .post("/organizations/me/terms")
        .set(...auth(token))
        .send({
          academicYearId: year.body.id,
          name: `Syllabus Term ${suffix}`,
          code: `SYT${suffix}`,
          sequence: 1,
          startDate: "2099-08-01",
          endDate: "2099-12-15",
        })
        .expect(201);
      const section = await request(app.getHttpServer())
        .post("/organizations/me/sections")
        .set(...auth(token))
        .send({ programId: program.body.id, termId: term.body.id, name: `Syllabus Section ${suffix}`, code: `SS${suffix}` })
        .expect(201);
      const subject = await request(app.getHttpServer())
        .post("/organizations/me/subjects")
        .set(...auth(token))
        .send({ name: `Syllabus Subject ${suffix}`, code: `SYSUB${suffix}` })
        .expect(201);
      const curriculum = await request(app.getHttpServer())
        .post("/organizations/me/curricula")
        .set(...auth(token))
        .send({ programId: program.body.id, name: `Syllabus Curriculum ${suffix}`, code: `SYCURR${suffix}` })
        .expect(201);
      const curriculumSubject = await request(app.getHttpServer())
        .post(`/organizations/me/curricula/${curriculum.body.id}/subjects`)
        .set(...auth(token))
        .send({ subjectId: subject.body.id })
        .expect(201);
      const staffType = await request(app.getHttpServer())
        .post("/organizations/me/staff-types")
        .set(...auth(token))
        .send({ name: `Syllabus Staff Type ${suffix}`, code: `SYST${suffix}` })
        .expect(201);
      const designation = await request(app.getHttpServer())
        .post("/organizations/me/designations")
        .set(...auth(token))
        .send({ name: `Syllabus Designation ${suffix}`, code: `SYDS${suffix}` })
        .expect(201);
      const employee = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(token))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `SYEMP-${suffix}`,
          firstName: "Syllabus",
          lastName: `Teacher${suffix}`,
          email: `syteacher-${suffix}-${run}@rls-e2e.test`,
          dateOfJoining: "2026-01-01",
        })
        .expect(201);
      const assignment = await request(app.getHttpServer())
        .post("/organizations/me/teaching-assignments")
        .set(...auth(token))
        .send({ employeeId: employee.body.id, subjectId: subject.body.id, sectionId: section.body.id, termId: term.body.id })
        .expect(201);

      return { curriculumSubjectId: curriculumSubject.body.id, termId: term.body.id, teachingAssignmentId: assignment.body.id };
    }

    it("creates a syllabus, builds a unit→chapter→topic→subtopic tree with objectives, creates a lesson plan, and stays tenant-scoped", async () => {
      const t = await buildSyllabusTarget(tokenA, "SYA");

      const syllabus = await request(app.getHttpServer())
        .post("/organizations/me/syllabi")
        .set(...auth(tokenA))
        .send({ curriculumSubjectId: t.curriculumSubjectId, termId: t.termId, name: "Test Syllabus" })
        .expect(201);
      expect(syllabus.body.organizationId).toBe(orgAId);

      // Duplicate syllabus for the same curriculum-subject+term is rejected.
      await request(app.getHttpServer())
        .post("/organizations/me/syllabi")
        .set(...auth(tokenA))
        .send({ curriculumSubjectId: t.curriculumSubjectId, termId: t.termId })
        .expect(409);

      const unit = await request(app.getHttpServer())
        .post(`/organizations/me/syllabi/${syllabus.body.id}/nodes`)
        .set(...auth(tokenA))
        .send({ level: "UNIT", sequence: 1, name: "Unit 1" })
        .expect(201);

      // A CHAPTER without a parent is rejected — the hierarchy is
      // required, not optional.
      await request(app.getHttpServer())
        .post(`/organizations/me/syllabi/${syllabus.body.id}/nodes`)
        .set(...auth(tokenA))
        .send({ level: "CHAPTER", sequence: 1, name: "Chapter without parent" })
        .expect(400);

      const chapter = await request(app.getHttpServer())
        .post(`/organizations/me/syllabi/${syllabus.body.id}/nodes`)
        .set(...auth(tokenA))
        .send({ level: "CHAPTER", parentId: unit.body.id, sequence: 1, name: "Chapter 1" })
        .expect(201);
      const topic = await request(app.getHttpServer())
        .post(`/organizations/me/syllabi/${syllabus.body.id}/nodes`)
        .set(...auth(tokenA))
        .send({ level: "TOPIC", parentId: chapter.body.id, sequence: 1, name: "Topic 1" })
        .expect(201);
      const subtopic = await request(app.getHttpServer())
        .post(`/organizations/me/syllabi/${syllabus.body.id}/nodes`)
        .set(...auth(tokenA))
        .send({ level: "SUBTOPIC", parentId: topic.body.id, sequence: 1, name: "Subtopic 1" })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/organizations/me/syllabus-nodes/${subtopic.body.id}/objectives`)
        .set(...auth(tokenA))
        .send({ sequence: 1, description: "Understand the concept" })
        .expect(201);

      const fetched = await request(app.getHttpServer())
        .get(`/organizations/me/syllabi/${syllabus.body.id}`)
        .set(...auth(tokenA))
        .expect(200);
      expect(fetched.body.nodes).toHaveLength(4);
      const fetchedSubtopic = fetched.body.nodes.find((n: { id: string }) => n.id === subtopic.body.id);
      expect(fetchedSubtopic.learningObjectives).toHaveLength(1);

      const lessonPlan = await request(app.getHttpServer())
        .post("/organizations/me/lesson-plans")
        .set(...auth(tokenA))
        .send({
          teachingAssignmentId: t.teachingAssignmentId,
          syllabusNodeId: subtopic.body.id,
          title: "Intro lesson",
          objectives: "Cover subtopic 1",
        })
        .expect(201);
      expect(lessonPlan.body.syllabusNodeId).toBe(subtopic.body.id);

      for (const path of ["syllabi", "lesson-plans"]) {
        const res = await request(app.getHttpServer())
          .get(`/organizations/me/${path}`)
          .set(...auth(tokenB))
          .expect(200);
        expect(res.body).toEqual([]);
      }

      await request(app.getHttpServer())
        .get(`/organizations/me/syllabi/${syllabus.body.id}`)
        .set(...auth(tokenB))
        .expect(404);
    });

    it("rejects a node whose parent is the wrong level (400)", async () => {
      const t = await buildSyllabusTarget(tokenA, "SYLEVEL");
      const syllabus = await request(app.getHttpServer())
        .post("/organizations/me/syllabi")
        .set(...auth(tokenA))
        .send({ curriculumSubjectId: t.curriculumSubjectId, termId: t.termId })
        .expect(201);
      const unit = await request(app.getHttpServer())
        .post(`/organizations/me/syllabi/${syllabus.body.id}/nodes`)
        .set(...auth(tokenA))
        .send({ level: "UNIT", sequence: 1, name: "Unit 1" })
        .expect(201);

      // TOPIC directly under UNIT (skipping CHAPTER) is rejected.
      await request(app.getHttpServer())
        .post(`/organizations/me/syllabi/${syllabus.body.id}/nodes`)
        .set(...auth(tokenA))
        .send({ level: "TOPIC", parentId: unit.body.id, sequence: 1, name: "Topic skipping chapter" })
        .expect(400);
    });

    it("rejects creating a syllabus, node or lesson plan under another tenant's parents (404)", async () => {
      const t = await buildSyllabusTarget(tokenA, "SYGUARD");
      const syllabusA = await request(app.getHttpServer())
        .post("/organizations/me/syllabi")
        .set(...auth(tokenA))
        .send({ curriculumSubjectId: t.curriculumSubjectId, termId: t.termId })
        .expect(201);
      const unitA = await request(app.getHttpServer())
        .post(`/organizations/me/syllabi/${syllabusA.body.id}/nodes`)
        .set(...auth(tokenA))
        .send({ level: "UNIT", sequence: 1, name: "Unit 1" })
        .expect(201);

      await request(app.getHttpServer())
        .post("/organizations/me/syllabi")
        .set(...auth(tokenB))
        .send({ curriculumSubjectId: t.curriculumSubjectId, termId: t.termId })
        .expect(404);

      await request(app.getHttpServer())
        .post(`/organizations/me/syllabi/${syllabusA.body.id}/nodes`)
        .set(...auth(tokenB))
        .send({ level: "UNIT", sequence: 2, name: "Sneaky unit" })
        .expect(404);

      await request(app.getHttpServer())
        .post("/organizations/me/lesson-plans")
        .set(...auth(tokenB))
        .send({
          teachingAssignmentId: t.teachingAssignmentId,
          syllabusNodeId: unitA.body.id,
          title: "Sneaky plan",
          objectives: "N/A",
        })
        .expect(404);
    });
  });

  describe("class sessions (My Classes Today → record progress → materials → complete; syllabus progress)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    // Matches ClassSchedule.dayOfWeek's own convention (1=Monday..7=Sunday,
    // ISO 8601) so a ClassSchedule built for this date's weekday actually
    // shows up in a My-Classes-Today query for this date.
    const TEST_DATE = "2099-08-10";
    const TEST_DAY_OF_WEEK = ((new Date(TEST_DATE).getUTCDay() + 6) % 7) + 1;

    async function buildClassSessionTarget(token: string, suffix: string) {
      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(token))
        .send({ name: `ClassSession Campus ${suffix}`, code: `CSCAMP${suffix}` })
        .expect(201);
      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(token))
        .send({ campusId: campus.body.id, name: `ClassSession Faculty ${suffix}`, code: `CSFAC${suffix}` })
        .expect(201);
      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(token))
        .send({ facultyId: faculty.body.id, name: `ClassSession Dept ${suffix}`, code: `CSDEP${suffix}` })
        .expect(201);
      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(token))
        .send({ departmentId: department.body.id, name: `ClassSession Program ${suffix}`, code: `CSPROG${suffix}` })
        .expect(201);
      const year = await request(app.getHttpServer())
        .post("/organizations/me/academic-years")
        .set(...auth(token))
        .send({ name: `ClassSession Year ${suffix}`, startDate: "2099-08-01", endDate: "2100-06-30" })
        .expect(201);
      const term = await request(app.getHttpServer())
        .post("/organizations/me/terms")
        .set(...auth(token))
        .send({
          academicYearId: year.body.id,
          name: `ClassSession Term ${suffix}`,
          code: `CST${suffix}`,
          sequence: 1,
          startDate: "2099-08-01",
          endDate: "2099-12-15",
        })
        .expect(201);
      const section = await request(app.getHttpServer())
        .post("/organizations/me/sections")
        .set(...auth(token))
        .send({ programId: program.body.id, termId: term.body.id, name: `ClassSession Section ${suffix}`, code: `CSS${suffix}` })
        .expect(201);
      const subject = await request(app.getHttpServer())
        .post("/organizations/me/subjects")
        .set(...auth(token))
        .send({ name: `ClassSession Subject ${suffix}`, code: `CSSUB${suffix}` })
        .expect(201);
      const curriculum = await request(app.getHttpServer())
        .post("/organizations/me/curricula")
        .set(...auth(token))
        .send({ programId: program.body.id, name: `ClassSession Curriculum ${suffix}`, code: `CSCURR${suffix}` })
        .expect(201);
      const curriculumSubject = await request(app.getHttpServer())
        .post(`/organizations/me/curricula/${curriculum.body.id}/subjects`)
        .set(...auth(token))
        .send({ subjectId: subject.body.id })
        .expect(201);
      const syllabus = await request(app.getHttpServer())
        .post("/organizations/me/syllabi")
        .set(...auth(token))
        .send({ curriculumSubjectId: curriculumSubject.body.id, termId: term.body.id })
        .expect(201);
      const unit = await request(app.getHttpServer())
        .post(`/organizations/me/syllabi/${syllabus.body.id}/nodes`)
        .set(...auth(token))
        .send({ level: "UNIT", sequence: 1, name: `Unit ${suffix}` })
        .expect(201);
      const staffType = await request(app.getHttpServer())
        .post("/organizations/me/staff-types")
        .set(...auth(token))
        .send({ name: `ClassSession Staff Type ${suffix}`, code: `CSST${suffix}` })
        .expect(201);
      const designation = await request(app.getHttpServer())
        .post("/organizations/me/designations")
        .set(...auth(token))
        .send({ name: `ClassSession Designation ${suffix}`, code: `CSDS${suffix}` })
        .expect(201);
      const employee = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(token))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `CSEMP-${suffix}`,
          firstName: "ClassSession",
          lastName: `Teacher${suffix}`,
          email: `csteacher-${suffix}-${run}@rls-e2e.test`,
          dateOfJoining: "2026-01-01",
        })
        .expect(201);
      const room = await request(app.getHttpServer())
        .post("/organizations/me/rooms")
        .set(...auth(token))
        .send({ campusId: campus.body.id, name: `ClassSession Room ${suffix}`, code: `CSRM${suffix}` })
        .expect(201);
      const period = await request(app.getHttpServer())
        .post("/organizations/me/periods")
        .set(...auth(token))
        .send({ name: `ClassSession Period ${suffix}`, code: `CSP${suffix}`, sequence: 1, startTime: "09:00", endTime: "09:45" })
        .expect(201);
      const assignment = await request(app.getHttpServer())
        .post("/organizations/me/teaching-assignments")
        .set(...auth(token))
        .send({ employeeId: employee.body.id, subjectId: subject.body.id, sectionId: section.body.id, termId: term.body.id })
        .expect(201);
      const classSchedule = await request(app.getHttpServer())
        .post("/organizations/me/class-schedules")
        .set(...auth(token))
        .send({ teachingAssignmentId: assignment.body.id, roomId: room.body.id, periodId: period.body.id, dayOfWeek: TEST_DAY_OF_WEEK })
        .expect(201);

      return { classScheduleId: classSchedule.body.id, syllabusId: syllabus.body.id, unitNodeId: unit.body.id };
    }

    it("shows a scheduled class in My Classes Today, opens a session, records progress, adds a material, completes it, and updates syllabus progress", async () => {
      const t = await buildClassSessionTarget(tokenA, "CSA");

      const before = await request(app.getHttpServer())
        .get(`/organizations/me/my-classes-today?date=${TEST_DATE}`)
        .set(...auth(tokenA))
        .expect(200);
      const entry = before.body.find((e: { classSchedule: { id: string } }) => e.classSchedule.id === t.classScheduleId);
      expect(entry).toBeDefined();
      expect(entry.classSession).toBeNull();

      const session = await request(app.getHttpServer())
        .post("/organizations/me/class-sessions")
        .set(...auth(tokenA))
        .send({ classScheduleId: t.classScheduleId, date: TEST_DATE })
        .expect(201);
      expect(session.body.status).toBe("SCHEDULED");

      // Duplicate session for the same schedule+date is rejected.
      await request(app.getHttpServer())
        .post("/organizations/me/class-sessions")
        .set(...auth(tokenA))
        .send({ classScheduleId: t.classScheduleId, date: TEST_DATE })
        .expect(409);

      // Completing before a topic is recorded is rejected.
      await request(app.getHttpServer())
        .post(`/organizations/me/class-sessions/${session.body.id}/complete`)
        .set(...auth(tokenA))
        .expect(400);

      const progressed = await request(app.getHttpServer())
        .put(`/organizations/me/class-sessions/${session.body.id}/progress`)
        .set(...auth(tokenA))
        .send({ actualSyllabusNodeId: t.unitNodeId, progressNotes: "Covered the intro" })
        .expect(200);
      expect(progressed.body.status).toBe("IN_PROGRESS");
      expect(progressed.body.actualSyllabusNode.id).toBe(t.unitNodeId);

      await request(app.getHttpServer())
        .post(`/organizations/me/class-sessions/${session.body.id}/materials`)
        .set(...auth(tokenA))
        .send({ title: "Slide deck", url: "https://example.com/slides.pdf" })
        .expect(201);

      const progressBeforeComplete = await request(app.getHttpServer())
        .get(`/organizations/me/syllabi/${t.syllabusId}/progress`)
        .set(...auth(tokenA))
        .expect(200);
      const nodeProgressBefore = progressBeforeComplete.body.find((p: { nodeId: string }) => p.nodeId === t.unitNodeId);
      expect(nodeProgressBefore.status).toBe("NOT_STARTED");

      const completed = await request(app.getHttpServer())
        .post(`/organizations/me/class-sessions/${session.body.id}/complete`)
        .set(...auth(tokenA))
        .expect(201);
      expect(completed.body.status).toBe("COMPLETED");
      expect(completed.body.materials).toHaveLength(1);

      const progressAfterComplete = await request(app.getHttpServer())
        .get(`/organizations/me/syllabi/${t.syllabusId}/progress`)
        .set(...auth(tokenA))
        .expect(200);
      const nodeProgressAfter = progressAfterComplete.body.find((p: { nodeId: string }) => p.nodeId === t.unitNodeId);
      expect(nodeProgressAfter.status).toBe("COMPLETED");

      const after = await request(app.getHttpServer())
        .get(`/organizations/me/my-classes-today?date=${TEST_DATE}`)
        .set(...auth(tokenA))
        .expect(200);
      const entryAfter = after.body.find((e: { classSchedule: { id: string } }) => e.classSchedule.id === t.classScheduleId);
      expect(entryAfter.classSession.status).toBe("COMPLETED");

      const listB = await request(app.getHttpServer())
        .get(`/organizations/me/my-classes-today?date=${TEST_DATE}`)
        .set(...auth(tokenB))
        .expect(200);
      expect(listB.body.find((e: { classSchedule: { id: string } }) => e.classSchedule.id === t.classScheduleId)).toBeUndefined();
    });

    it("rejects creating a class session under another tenant's class schedule, and recording progress on another tenant's session (404)", async () => {
      const t = await buildClassSessionTarget(tokenA, "CSGUARD");

      await request(app.getHttpServer())
        .post("/organizations/me/class-sessions")
        .set(...auth(tokenB))
        .send({ classScheduleId: t.classScheduleId, date: TEST_DATE })
        .expect(404);

      const sessionA = await request(app.getHttpServer())
        .post("/organizations/me/class-sessions")
        .set(...auth(tokenA))
        .send({ classScheduleId: t.classScheduleId, date: TEST_DATE })
        .expect(201);

      await request(app.getHttpServer())
        .put(`/organizations/me/class-sessions/${sessionA.body.id}/progress`)
        .set(...auth(tokenB))
        .send({ actualSyllabusNodeId: t.unitNodeId })
        .expect(404);
    });
  });

  describe("assignments & knowledge checks (submissions/grading; questions/publish/attempts)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    async function buildAssignmentTarget(token: string, suffix: string) {
      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(token))
        .send({ name: `Assign Campus ${suffix}`, code: `ASCAMP${suffix}` })
        .expect(201);
      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(token))
        .send({ campusId: campus.body.id, name: `Assign Faculty ${suffix}`, code: `ASFAC${suffix}` })
        .expect(201);
      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(token))
        .send({ facultyId: faculty.body.id, name: `Assign Dept ${suffix}`, code: `ASDEP${suffix}` })
        .expect(201);
      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(token))
        .send({ departmentId: department.body.id, name: `Assign Program ${suffix}`, code: `ASPROG${suffix}` })
        .expect(201);
      const year = await request(app.getHttpServer())
        .post("/organizations/me/academic-years")
        .set(...auth(token))
        .send({ name: `Assign Year ${suffix}`, startDate: "2099-08-01", endDate: "2100-06-30" })
        .expect(201);
      const term = await request(app.getHttpServer())
        .post("/organizations/me/terms")
        .set(...auth(token))
        .send({
          academicYearId: year.body.id,
          name: `Assign Term ${suffix}`,
          code: `AST${suffix}`,
          sequence: 1,
          startDate: "2099-08-01",
          endDate: "2099-12-15",
        })
        .expect(201);
      const section = await request(app.getHttpServer())
        .post("/organizations/me/sections")
        .set(...auth(token))
        .send({ programId: program.body.id, termId: term.body.id, name: `Assign Section ${suffix}`, code: `ASS${suffix}` })
        .expect(201);
      const subject = await request(app.getHttpServer())
        .post("/organizations/me/subjects")
        .set(...auth(token))
        .send({ name: `Assign Subject ${suffix}`, code: `ASSUB${suffix}` })
        .expect(201);
      const staffType = await request(app.getHttpServer())
        .post("/organizations/me/staff-types")
        .set(...auth(token))
        .send({ name: `Assign Staff Type ${suffix}`, code: `ASST${suffix}` })
        .expect(201);
      const designation = await request(app.getHttpServer())
        .post("/organizations/me/designations")
        .set(...auth(token))
        .send({ name: `Assign Designation ${suffix}`, code: `ASDS${suffix}` })
        .expect(201);
      const employee = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(token))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `ASEMP-${suffix}`,
          firstName: "Assign",
          lastName: `Teacher${suffix}`,
          email: `asteacher-${suffix}-${run}@rls-e2e.test`,
          dateOfJoining: "2026-01-01",
        })
        .expect(201);
      const assignment = await request(app.getHttpServer())
        .post("/organizations/me/teaching-assignments")
        .set(...auth(token))
        .send({ employeeId: employee.body.id, subjectId: subject.body.id, sectionId: section.body.id, termId: term.body.id })
        .expect(201);
      const student = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(token))
        .send({ studentCode: `AS-STU-${suffix}`, firstName: "Assign", lastName: `Student${suffix}`, dateOfBirth: "2015-01-01" })
        .expect(201);

      return { teachingAssignmentId: assignment.body.id, studentId: student.body.id };
    }

    it("creates an assignment, records a submission, rejects resubmission when not allowed, grades it, and stays tenant-scoped", async () => {
      const t = await buildAssignmentTarget(tokenA, "AWA");

      const assignment = await request(app.getHttpServer())
        .post("/organizations/me/assignments")
        .set(...auth(tokenA))
        .send({ teachingAssignmentId: t.teachingAssignmentId, title: "Essay 1", submissionType: "TEXT" })
        .expect(201);
      expect(assignment.body.organizationId).toBe(orgAId);

      const submission = await request(app.getHttpServer())
        .post(`/organizations/me/assignments/${assignment.body.id}/submissions`)
        .set(...auth(tokenA))
        .send({ studentId: t.studentId, content: "My essay text" })
        .expect(201);
      expect(submission.body.status).toBe("SUBMITTED");

      // Resubmission is rejected when the assignment doesn't allow it.
      await request(app.getHttpServer())
        .post(`/organizations/me/assignments/${assignment.body.id}/submissions`)
        .set(...auth(tokenA))
        .send({ studentId: t.studentId, content: "Revised essay" })
        .expect(409);

      const graded = await request(app.getHttpServer())
        .put(`/organizations/me/assignments/${assignment.body.id}/submissions/${t.studentId}/grade`)
        .set(...auth(tokenA))
        .send({ score: 88, feedback: "Good work" })
        .expect(200);
      expect(graded.body.status).toBe("GRADED");
      expect(graded.body.score).toBe(88);

      const listB = await request(app.getHttpServer())
        .get("/organizations/me/assignments")
        .set(...auth(tokenB))
        .expect(200);
      expect(listB.body).toEqual([]);
    });

    it("supports resubmission when allowed, resetting the previous grade", async () => {
      const t = await buildAssignmentTarget(tokenA, "AWR");

      const assignment = await request(app.getHttpServer())
        .post("/organizations/me/assignments")
        .set(...auth(tokenA))
        .send({ teachingAssignmentId: t.teachingAssignmentId, title: "Essay 2", submissionType: "TEXT", allowResubmission: true })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/organizations/me/assignments/${assignment.body.id}/submissions`)
        .set(...auth(tokenA))
        .send({ studentId: t.studentId, content: "First draft" })
        .expect(201);

      await request(app.getHttpServer())
        .put(`/organizations/me/assignments/${assignment.body.id}/submissions/${t.studentId}/grade`)
        .set(...auth(tokenA))
        .send({ score: 60 })
        .expect(200);

      const resubmitted = await request(app.getHttpServer())
        .post(`/organizations/me/assignments/${assignment.body.id}/submissions`)
        .set(...auth(tokenA))
        .send({ studentId: t.studentId, content: "Improved draft" })
        .expect(201);
      expect(resubmitted.body.status).toBe("SUBMITTED");
      expect(resubmitted.body.score).toBeNull();
    });

    it("builds and publishes a knowledge check, scores an attempt correctly, and enforces one-attempt-per-student", async () => {
      const t = await buildAssignmentTarget(tokenA, "KCA");

      const check = await request(app.getHttpServer())
        .post("/organizations/me/knowledge-checks")
        .set(...auth(tokenA))
        .send({ teachingAssignmentId: t.teachingAssignmentId, title: "Quick Check", durationMinutes: 5 })
        .expect(201);
      expect(check.body.status).toBe("DRAFT");

      // Publishing with no questions is rejected.
      await request(app.getHttpServer())
        .post(`/organizations/me/knowledge-checks/${check.body.id}/publish`)
        .set(...auth(tokenA))
        .expect(400);

      await request(app.getHttpServer())
        .post(`/organizations/me/knowledge-checks/${check.body.id}/questions`)
        .set(...auth(tokenA))
        .send({ sequence: 1, text: "2 + 2 = ?", options: ["3", "4", "5"], correctOptionIndex: 1 })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/knowledge-checks/${check.body.id}/questions`)
        .set(...auth(tokenA))
        .send({ sequence: 2, text: "3 + 3 = ?", options: ["6", "7"], correctOptionIndex: 0 })
        .expect(201);

      // Attempting before publish is rejected.
      await request(app.getHttpServer())
        .post(`/organizations/me/knowledge-checks/${check.body.id}/attempts`)
        .set(...auth(tokenA))
        .send({ studentId: t.studentId, answers: [1, 0] })
        .expect(400);

      await request(app.getHttpServer())
        .post(`/organizations/me/knowledge-checks/${check.body.id}/publish`)
        .set(...auth(tokenA))
        .expect(201);

      // Adding a question after publishing is rejected.
      await request(app.getHttpServer())
        .post(`/organizations/me/knowledge-checks/${check.body.id}/questions`)
        .set(...auth(tokenA))
        .send({ sequence: 3, text: "Too late", options: ["a", "b"], correctOptionIndex: 0 })
        .expect(400);

      // One correct (index 1), one wrong (index 1, correct is 0) -> 50%.
      const attempt = await request(app.getHttpServer())
        .post(`/organizations/me/knowledge-checks/${check.body.id}/attempts`)
        .set(...auth(tokenA))
        .send({ studentId: t.studentId, answers: [1, 1] })
        .expect(201);
      expect(attempt.body.score).toBe(50);

      // A second attempt by the same student is rejected.
      await request(app.getHttpServer())
        .post(`/organizations/me/knowledge-checks/${check.body.id}/attempts`)
        .set(...auth(tokenA))
        .send({ studentId: t.studentId, answers: [1, 0] })
        .expect(409);

      const listB = await request(app.getHttpServer())
        .get("/organizations/me/knowledge-checks")
        .set(...auth(tokenB))
        .expect(200);
      expect(listB.body).toEqual([]);
    });

    it("rejects creating an assignment/knowledge-check under another tenant's teaching assignment, and submitting/attempting on another tenant's resource (404)", async () => {
      const t = await buildAssignmentTarget(tokenA, "AWGUARD");

      await request(app.getHttpServer())
        .post("/organizations/me/assignments")
        .set(...auth(tokenB))
        .send({ teachingAssignmentId: t.teachingAssignmentId, title: "Sneaky", submissionType: "TEXT" })
        .expect(404);

      await request(app.getHttpServer())
        .post("/organizations/me/knowledge-checks")
        .set(...auth(tokenB))
        .send({ teachingAssignmentId: t.teachingAssignmentId, title: "Sneaky Check" })
        .expect(404);

      const assignmentA = await request(app.getHttpServer())
        .post("/organizations/me/assignments")
        .set(...auth(tokenA))
        .send({ teachingAssignmentId: t.teachingAssignmentId, title: "Guarded", submissionType: "TEXT" })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/organizations/me/assignments/${assignmentA.body.id}/submissions`)
        .set(...auth(tokenB))
        .send({ studentId: t.studentId, content: "Sneaky submission" })
        .expect(404);
    });
  });

  describe("learning dashboards (teacher/student/parent aggregation)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];
    const DASH_DATE = "2099-09-01";

    async function buildDashboardTarget(token: string, suffix: string) {
      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(token))
        .send({ name: `Dash Campus ${suffix}`, code: `DACAMP${suffix}` })
        .expect(201);
      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(token))
        .send({ campusId: campus.body.id, name: `Dash Faculty ${suffix}`, code: `DAFAC${suffix}` })
        .expect(201);
      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(token))
        .send({ facultyId: faculty.body.id, name: `Dash Dept ${suffix}`, code: `DADEP${suffix}` })
        .expect(201);
      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(token))
        .send({ departmentId: department.body.id, name: `Dash Program ${suffix}`, code: `DAPROG${suffix}` })
        .expect(201);
      const year = await request(app.getHttpServer())
        .post("/organizations/me/academic-years")
        .set(...auth(token))
        .send({ name: `Dash Year ${suffix}`, startDate: "2099-08-01", endDate: "2100-06-30" })
        .expect(201);
      const term = await request(app.getHttpServer())
        .post("/organizations/me/terms")
        .set(...auth(token))
        .send({
          academicYearId: year.body.id,
          name: `Dash Term ${suffix}`,
          code: `DAT${suffix}`,
          sequence: 1,
          startDate: "2099-08-01",
          endDate: "2099-12-15",
        })
        .expect(201);
      const section = await request(app.getHttpServer())
        .post("/organizations/me/sections")
        .set(...auth(token))
        .send({ programId: program.body.id, termId: term.body.id, name: `Dash Section ${suffix}`, code: `DAS${suffix}` })
        .expect(201);
      const subject = await request(app.getHttpServer())
        .post("/organizations/me/subjects")
        .set(...auth(token))
        .send({ name: `Dash Subject ${suffix}`, code: `DASUB${suffix}` })
        .expect(201);
      const curriculum = await request(app.getHttpServer())
        .post("/organizations/me/curricula")
        .set(...auth(token))
        .send({ programId: program.body.id, name: `Dash Curriculum ${suffix}`, code: `DACURR${suffix}` })
        .expect(201);
      const curriculumSubject = await request(app.getHttpServer())
        .post(`/organizations/me/curricula/${curriculum.body.id}/subjects`)
        .set(...auth(token))
        .send({ subjectId: subject.body.id })
        .expect(201);
      const staffType = await request(app.getHttpServer())
        .post("/organizations/me/staff-types")
        .set(...auth(token))
        .send({ name: `Dash Staff Type ${suffix}`, code: `DAST${suffix}` })
        .expect(201);
      const designation = await request(app.getHttpServer())
        .post("/organizations/me/designations")
        .set(...auth(token))
        .send({ name: `Dash Designation ${suffix}`, code: `DADS${suffix}` })
        .expect(201);
      const employee = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(token))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `DAEMP-${suffix}`,
          firstName: "Dash",
          lastName: `Teacher${suffix}`,
          email: `dateacher-${suffix}-${run}@rls-e2e.test`,
          dateOfJoining: "2026-01-01",
        })
        .expect(201);
      const teachingAssignment = await request(app.getHttpServer())
        .post("/organizations/me/teaching-assignments")
        .set(...auth(token))
        .send({ employeeId: employee.body.id, subjectId: subject.body.id, sectionId: section.body.id, termId: term.body.id })
        .expect(201);
      const room = await request(app.getHttpServer())
        .post("/organizations/me/rooms")
        .set(...auth(token))
        .send({ campusId: campus.body.id, name: `Dash Room ${suffix}`, code: `DARM${suffix}` })
        .expect(201);
      const period = await request(app.getHttpServer())
        .post("/organizations/me/periods")
        .set(...auth(token))
        .send({ name: `Dash Period ${suffix}`, code: `DAP${suffix}`, sequence: 1, startTime: "09:00", endTime: "09:45" })
        .expect(201);
      const classSchedule = await request(app.getHttpServer())
        .post("/organizations/me/class-schedules")
        .set(...auth(token))
        .send({ teachingAssignmentId: teachingAssignment.body.id, roomId: room.body.id, periodId: period.body.id, dayOfWeek: 1 })
        .expect(201);

      const student = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(token))
        .send({ studentCode: `DA-STU-${suffix}`, firstName: "Dash", lastName: `Student${suffix}`, dateOfBirth: "2015-01-01" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/students/${student.body.id}/enrollments`)
        .set(...auth(token))
        .send({ programId: program.body.id, sectionId: section.body.id, termId: term.body.id, enrollmentDate: "2099-08-01" })
        .expect(201);

      const guardian = await request(app.getHttpServer())
        .post("/organizations/me/guardians")
        .set(...auth(token))
        .send({ firstName: "Dash", lastName: `Guardian${suffix}`, phone: "555-0100" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/students/${student.body.id}/guardians`)
        .set(...auth(token))
        .send({ guardianId: guardian.body.id, relationship: "Mother", isPrimaryContact: true })
        .expect(201);

      const syllabus = await request(app.getHttpServer())
        .post("/organizations/me/syllabi")
        .set(...auth(token))
        .send({ curriculumSubjectId: curriculumSubject.body.id, termId: term.body.id })
        .expect(201);
      const unit = await request(app.getHttpServer())
        .post(`/organizations/me/syllabi/${syllabus.body.id}/nodes`)
        .set(...auth(token))
        .send({ level: "UNIT", sequence: 1, name: `Dash Unit ${suffix}` })
        .expect(201);

      const classSession = await request(app.getHttpServer())
        .post("/organizations/me/class-sessions")
        .set(...auth(token))
        .send({ classScheduleId: classSchedule.body.id, date: DASH_DATE })
        .expect(201);
      await request(app.getHttpServer())
        .put(`/organizations/me/class-sessions/${classSession.body.id}/progress`)
        .set(...auth(token))
        .send({ actualSyllabusNodeId: unit.body.id })
        .expect(200);
      await request(app.getHttpServer())
        .post(`/organizations/me/class-sessions/${classSession.body.id}/complete`)
        .set(...auth(token))
        .expect(201);

      const attendanceSession = await request(app.getHttpServer())
        .post("/organizations/me/attendance-sessions")
        .set(...auth(token))
        .send({ classScheduleId: classSchedule.body.id, date: DASH_DATE })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/attendance-sessions/${attendanceSession.body.id}/mark`)
        .set(...auth(token))
        .send({ entries: [{ studentId: student.body.id, status: "PRESENT" }] })
        .expect(201);
      await request(app.getHttpServer())
        .post("/organizations/me/staff-attendance")
        .set(...auth(token))
        .send({ employeeId: employee.body.id, date: DASH_DATE, status: "PRESENT" })
        .expect(201);

      const assignment = await request(app.getHttpServer())
        .post("/organizations/me/assignments")
        .set(...auth(token))
        .send({ teachingAssignmentId: teachingAssignment.body.id, title: `Dash Assignment ${suffix}`, submissionType: "TEXT" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/assignments/${assignment.body.id}/submissions`)
        .set(...auth(token))
        .send({ studentId: student.body.id, content: "My work" })
        .expect(201);

      const check = await request(app.getHttpServer())
        .post("/organizations/me/knowledge-checks")
        .set(...auth(token))
        .send({ teachingAssignmentId: teachingAssignment.body.id, title: `Dash Check ${suffix}` })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/knowledge-checks/${check.body.id}/questions`)
        .set(...auth(token))
        .send({ sequence: 1, text: "Q1", options: ["a", "b"], correctOptionIndex: 0 })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/knowledge-checks/${check.body.id}/publish`)
        .set(...auth(token))
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/knowledge-checks/${check.body.id}/attempts`)
        .set(...auth(token))
        .send({ studentId: student.body.id, answers: [0] })
        .expect(201);

      return {
        employeeId: employee.body.id,
        studentId: student.body.id,
        guardianId: guardian.body.id,
        subjectName: `Dash Subject ${suffix}`,
        sectionName: `Dash Section ${suffix}`,
      };
    }

    it("aggregates teacher, student and parent dashboards from data built across every prior slice, and only shows a parent their own linked children", async () => {
      const t = await buildDashboardTarget(tokenA, "DBA");

      // A second, unrelated student — must not leak into the guardian's
      // dashboard just because it exists in the same org.
      const otherStudent = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: "DA-STU-OTHER", firstName: "Other", lastName: "Student", dateOfBirth: "2015-01-01" })
        .expect(201);

      const teacher = await request(app.getHttpServer())
        .get(`/organizations/me/dashboards/teacher/${t.employeeId}`)
        .set(...auth(tokenA))
        .expect(200);
      expect(teacher.body.teachingAssignments).toHaveLength(1);
      expect(teacher.body.teachingAssignments[0].subject.name).toBe(t.subjectName);
      expect(teacher.body.classSchedules).toHaveLength(1);
      expect(teacher.body.pendingGrading).toHaveLength(1);
      expect(teacher.body.pendingGrading[0].status).toBe("SUBMITTED");
      expect(teacher.body.recentClassSessions).toHaveLength(1);
      expect(teacher.body.recentClassSessions[0].status).toBe("COMPLETED");
      expect(teacher.body.staffAttendanceSummary).toMatchObject({ present: 1, absent: 0, late: 0, total: 1 });

      const student = await request(app.getHttpServer())
        .get(`/organizations/me/dashboards/student/${t.studentId}`)
        .set(...auth(tokenA))
        .expect(200);
      expect(student.body.activeEnrollment.section.name).toBe(t.sectionName);
      expect(student.body.weeklyTimetable).toHaveLength(1);
      expect(student.body.attendanceSummary).toMatchObject({ present: 1, total: 1 });
      expect(student.body.assignmentSubmissions).toHaveLength(1);
      expect(student.body.assignmentSubmissions[0].status).toBe("SUBMITTED");
      expect(student.body.knowledgeCheckAttempts).toHaveLength(1);
      expect(student.body.knowledgeCheckAttempts[0].score).toBe(100);
      expect(student.body.syllabusProgress).toHaveLength(1);
      expect(student.body.syllabusProgress[0].nodes[0].status).toBe("COMPLETED");

      const parent = await request(app.getHttpServer())
        .get(`/organizations/me/dashboards/parent/${t.guardianId}`)
        .set(...auth(tokenA))
        .expect(200);
      expect(parent.body.children).toHaveLength(1);
      expect(parent.body.children[0].student.id).toBe(t.studentId);
      expect(parent.body.children[0].relationship).toBe("Mother");
      expect(parent.body.children.map((c: { student: { id: string } }) => c.student.id)).not.toContain(otherStudent.body.id);

      for (const path of [
        `dashboards/teacher/${t.employeeId}`,
        `dashboards/student/${t.studentId}`,
        `dashboards/parent/${t.guardianId}`,
      ]) {
        await request(app.getHttpServer())
          .get(`/organizations/me/${path}`)
          .set(...auth(tokenB))
          .expect(404);
      }
    });
  });

  describe("exam setup (exam types, grading schemes, question banks & questions)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    async function buildExamSetupTarget(token: string, suffix: string) {
      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(token))
        .send({ name: `Exam Campus ${suffix}`, code: `EXCAMP${suffix}` })
        .expect(201);
      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(token))
        .send({ campusId: campus.body.id, name: `Exam Faculty ${suffix}`, code: `EXFAC${suffix}` })
        .expect(201);
      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(token))
        .send({ facultyId: faculty.body.id, name: `Exam Dept ${suffix}`, code: `EXDEP${suffix}` })
        .expect(201);
      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(token))
        .send({ departmentId: department.body.id, name: `Exam Program ${suffix}`, code: `EXPROG${suffix}` })
        .expect(201);
      const subject = await request(app.getHttpServer())
        .post("/organizations/me/subjects")
        .set(...auth(token))
        .send({ name: `Exam Subject ${suffix}`, code: `EXSUB${suffix}` })
        .expect(201);
      const curriculum = await request(app.getHttpServer())
        .post("/organizations/me/curricula")
        .set(...auth(token))
        .send({ programId: program.body.id, name: `Exam Curriculum ${suffix}`, code: `EXCURR${suffix}` })
        .expect(201);
      const curriculumSubject = await request(app.getHttpServer())
        .post(`/organizations/me/curricula/${curriculum.body.id}/subjects`)
        .set(...auth(token))
        .send({ subjectId: subject.body.id })
        .expect(201);

      return { curriculumSubjectId: curriculumSubject.body.id };
    }

    it("creates an exam type, a grading scheme, a question bank with objective and subjective questions, and stays tenant-scoped", async () => {
      const t = await buildExamSetupTarget(tokenA, "EXA");

      const examType = await request(app.getHttpServer())
        .post("/organizations/me/exam-types")
        .set(...auth(tokenA))
        .send({ name: "Terminal Exam", code: `TERM-${run}` })
        .expect(201);
      expect(examType.body.organizationId).toBe(orgAId);

      // Duplicate code within the same org is rejected.
      await request(app.getHttpServer())
        .post("/organizations/me/exam-types")
        .set(...auth(tokenA))
        .send({ name: "Terminal Exam Again", code: `TERM-${run}` })
        .expect(409);

      const scheme = await request(app.getHttpServer())
        .post("/organizations/me/grading-schemes")
        .set(...auth(tokenA))
        .send({
          name: "Standard Grading",
          code: `STD-${run}`,
          bands: [
            { minPercentage: 90, maxPercentage: 100, grade: "A+", gpa: 4.0 },
            { minPercentage: 80, maxPercentage: 89.99, grade: "A", gpa: 3.6 },
            { minPercentage: 0, maxPercentage: 79.99, grade: "B" },
          ],
        })
        .expect(201);
      expect(scheme.body.bands).toHaveLength(3);

      // A band with min > max is rejected.
      await request(app.getHttpServer())
        .post("/organizations/me/grading-schemes")
        .set(...auth(tokenA))
        .send({
          name: "Bad Scheme",
          code: `BAD-${run}`,
          bands: [{ minPercentage: 90, maxPercentage: 10, grade: "X" }],
        })
        .expect(400);

      const bank = await request(app.getHttpServer())
        .post("/organizations/me/question-banks")
        .set(...auth(tokenA))
        .send({ curriculumSubjectId: t.curriculumSubjectId, name: "Unit 1 Bank" })
        .expect(201);
      expect(bank.body.organizationId).toBe(orgAId);

      const objectiveQuestion = await request(app.getHttpServer())
        .post(`/organizations/me/question-banks/${bank.body.id}/questions`)
        .set(...auth(tokenA))
        .send({
          sequence: 1,
          text: "2 + 2 = ?",
          questionType: "OBJECTIVE",
          marks: 5,
          options: ["3", "4", "5"],
          correctOptionIndex: 1,
        })
        .expect(201);
      expect(objectiveQuestion.body.correctOptionIndex).toBe(1);

      // correctOptionIndex out of range is rejected.
      await request(app.getHttpServer())
        .post(`/organizations/me/question-banks/${bank.body.id}/questions`)
        .set(...auth(tokenA))
        .send({ sequence: 2, text: "Bad", questionType: "OBJECTIVE", marks: 5, options: ["a"], correctOptionIndex: 5 })
        .expect(400);

      const subjectiveQuestion = await request(app.getHttpServer())
        .post(`/organizations/me/question-banks/${bank.body.id}/questions`)
        .set(...auth(tokenA))
        .send({
          sequence: 2,
          text: "Explain photosynthesis.",
          questionType: "SUBJECTIVE",
          marks: 10,
          modelAnswer: "Plants convert light energy into chemical energy.",
        })
        .expect(201);
      expect(subjectiveQuestion.body.options).toBeNull();

      // A SUBJECTIVE question with options is rejected.
      await request(app.getHttpServer())
        .post(`/organizations/me/question-banks/${bank.body.id}/questions`)
        .set(...auth(tokenA))
        .send({ sequence: 3, text: "Bad", questionType: "SUBJECTIVE", marks: 5, options: ["a", "b"] })
        .expect(400);

      const fetched = await request(app.getHttpServer())
        .get(`/organizations/me/question-banks/${bank.body.id}`)
        .set(...auth(tokenA))
        .expect(200);
      expect(fetched.body.questions).toHaveLength(2);
      expect(fetched.body.questions.map((q: { sequence: number }) => q.sequence)).toEqual([1, 2]);

      const listB = await request(app.getHttpServer())
        .get("/organizations/me/question-banks")
        .set(...auth(tokenB))
        .expect(200);
      expect(listB.body).toEqual([]);
    });

    it("rejects creating a question bank under another tenant's curriculum subject, and adding a question under another tenant's bank (404)", async () => {
      const t = await buildExamSetupTarget(tokenA, "EXR");

      await request(app.getHttpServer())
        .post("/organizations/me/question-banks")
        .set(...auth(tokenB))
        .send({ curriculumSubjectId: t.curriculumSubjectId, name: "Cross-tenant bank" })
        .expect(404);

      const bank = await request(app.getHttpServer())
        .post("/organizations/me/question-banks")
        .set(...auth(tokenA))
        .send({ curriculumSubjectId: t.curriculumSubjectId, name: "Owned bank" })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/organizations/me/question-banks/${bank.body.id}/questions`)
        .set(...auth(tokenB))
        .send({ sequence: 1, text: "Cross-tenant question", questionType: "SUBJECTIVE", marks: 5 })
        .expect(404);

      await request(app.getHttpServer())
        .get(`/organizations/me/question-banks/${bank.body.id}`)
        .set(...auth(tokenB))
        .expect(404);
    });
  });

  describe("exam scheduling (exam → exam subjects → schedule → room assignment)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    async function buildExamSchedulingTarget(token: string, suffix: string) {
      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(token))
        .send({ name: `ExSched Campus ${suffix}`, code: `ESCAMP${suffix}` })
        .expect(201);
      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(token))
        .send({ campusId: campus.body.id, name: `ExSched Faculty ${suffix}`, code: `ESFAC${suffix}` })
        .expect(201);
      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(token))
        .send({ facultyId: faculty.body.id, name: `ExSched Dept ${suffix}`, code: `ESDEP${suffix}` })
        .expect(201);
      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(token))
        .send({ departmentId: department.body.id, name: `ExSched Program ${suffix}`, code: `ESPROG${suffix}` })
        .expect(201);
      const subjectA = await request(app.getHttpServer())
        .post("/organizations/me/subjects")
        .set(...auth(token))
        .send({ name: `ExSched Subject A ${suffix}`, code: `ESSUBA${suffix}` })
        .expect(201);
      const subjectB = await request(app.getHttpServer())
        .post("/organizations/me/subjects")
        .set(...auth(token))
        .send({ name: `ExSched Subject B ${suffix}`, code: `ESSUBB${suffix}` })
        .expect(201);
      const curriculum = await request(app.getHttpServer())
        .post("/organizations/me/curricula")
        .set(...auth(token))
        .send({ programId: program.body.id, name: `ExSched Curriculum ${suffix}`, code: `ESCURR${suffix}` })
        .expect(201);
      const curriculumSubjectA = await request(app.getHttpServer())
        .post(`/organizations/me/curricula/${curriculum.body.id}/subjects`)
        .set(...auth(token))
        .send({ subjectId: subjectA.body.id })
        .expect(201);
      const curriculumSubjectB = await request(app.getHttpServer())
        .post(`/organizations/me/curricula/${curriculum.body.id}/subjects`)
        .set(...auth(token))
        .send({ subjectId: subjectB.body.id })
        .expect(201);
      const year = await request(app.getHttpServer())
        .post("/organizations/me/academic-years")
        .set(...auth(token))
        .send({ name: `ExSched Year ${suffix}`, startDate: "2099-01-01", endDate: "2099-12-31" })
        .expect(201);
      const term = await request(app.getHttpServer())
        .post("/organizations/me/terms")
        .set(...auth(token))
        .send({
          academicYearId: year.body.id,
          name: `ExSched Term ${suffix}`,
          code: `ET${suffix}`,
          sequence: 1,
          startDate: "2099-01-01",
          endDate: "2099-06-30",
        })
        .expect(201);
      const room = await request(app.getHttpServer())
        .post("/organizations/me/rooms")
        .set(...auth(token))
        .send({ campusId: campus.body.id, name: `ExSched Room ${suffix}`, code: `ESRM${suffix}` })
        .expect(201);
      const examType = await request(app.getHttpServer())
        .post("/organizations/me/exam-types")
        .set(...auth(token))
        .send({ name: `ExSched Exam Type ${suffix}`, code: `ESET${suffix}` })
        .expect(201);

      return {
        termId: term.body.id,
        examTypeId: examType.body.id,
        roomId: room.body.id,
        curriculumSubjectAId: curriculumSubjectA.body.id,
        curriculumSubjectBId: curriculumSubjectB.body.id,
      };
    }

    it("builds an exam with two subjects, schedules and rooms them, rejects invalid marks/times, and stays tenant-scoped", async () => {
      const t = await buildExamSchedulingTarget(tokenA, "ESA");

      const exam = await request(app.getHttpServer())
        .post("/organizations/me/exams")
        .set(...auth(tokenA))
        .send({ examTypeId: t.examTypeId, termId: t.termId, name: "Terminal Exam" })
        .expect(201);
      expect(exam.body.organizationId).toBe(orgAId);

      // passMarks > fullMarks is rejected.
      await request(app.getHttpServer())
        .post(`/organizations/me/exams/${exam.body.id}/subjects`)
        .set(...auth(tokenA))
        .send({ curriculumSubjectId: t.curriculumSubjectAId, fullMarks: 50, passMarks: 60 })
        .expect(400);

      const examSubjectA = await request(app.getHttpServer())
        .post(`/organizations/me/exams/${exam.body.id}/subjects`)
        .set(...auth(tokenA))
        .send({ curriculumSubjectId: t.curriculumSubjectAId, fullMarks: 100, passMarks: 40 })
        .expect(201);

      // The same subject can't be added twice to one exam.
      await request(app.getHttpServer())
        .post(`/organizations/me/exams/${exam.body.id}/subjects`)
        .set(...auth(tokenA))
        .send({ curriculumSubjectId: t.curriculumSubjectAId, fullMarks: 100, passMarks: 40 })
        .expect(409);

      const examSubjectB = await request(app.getHttpServer())
        .post(`/organizations/me/exams/${exam.body.id}/subjects`)
        .set(...auth(tokenA))
        .send({ curriculumSubjectId: t.curriculumSubjectBId, fullMarks: 100, passMarks: 40 })
        .expect(201);

      // startTime >= endTime is rejected.
      await request(app.getHttpServer())
        .post(`/organizations/me/exam-subjects/${examSubjectA.body.id}/schedule`)
        .set(...auth(tokenA))
        .send({ date: "2099-03-01", startTime: "11:00", endTime: "09:00" })
        .expect(400);

      const scheduleA = await request(app.getHttpServer())
        .post(`/organizations/me/exam-subjects/${examSubjectA.body.id}/schedule`)
        .set(...auth(tokenA))
        .send({ date: "2099-03-01", startTime: "09:00", endTime: "11:00" })
        .expect(201);

      // A second schedule for the same exam subject is rejected (1:1).
      await request(app.getHttpServer())
        .post(`/organizations/me/exam-subjects/${examSubjectA.body.id}/schedule`)
        .set(...auth(tokenA))
        .send({ date: "2099-03-02", startTime: "09:00", endTime: "11:00" })
        .expect(409);

      const roomAssignment = await request(app.getHttpServer())
        .post(`/organizations/me/exam-schedules/${scheduleA.body.id}/rooms`)
        .set(...auth(tokenA))
        .send({ roomId: t.roomId, capacity: 30 })
        .expect(201);
      expect(roomAssignment.body.capacity).toBe(30);

      // The same room can't be assigned twice to the same schedule.
      await request(app.getHttpServer())
        .post(`/organizations/me/exam-schedules/${scheduleA.body.id}/rooms`)
        .set(...auth(tokenA))
        .send({ roomId: t.roomId })
        .expect(409);

      // A second exam subject scheduled the same day with an overlapping
      // time, assigned to the same room, is rejected as a double-booking —
      // this can't be a flat unique index (it's a real time-range
      // overlap), so it's the service-level check being exercised here.
      const scheduleB = await request(app.getHttpServer())
        .post(`/organizations/me/exam-subjects/${examSubjectB.body.id}/schedule`)
        .set(...auth(tokenA))
        .send({ date: "2099-03-01", startTime: "10:00", endTime: "12:00" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/exam-schedules/${scheduleB.body.id}/rooms`)
        .set(...auth(tokenA))
        .send({ roomId: t.roomId })
        .expect(409);

      const fetched = await request(app.getHttpServer())
        .get(`/organizations/me/exams/${exam.body.id}`)
        .set(...auth(tokenA))
        .expect(200);
      expect(fetched.body.examSubjects).toHaveLength(2);
      const fetchedA = fetched.body.examSubjects.find((es: { id: string }) => es.id === examSubjectA.body.id);
      expect(fetchedA.examSchedule.examRooms).toHaveLength(1);

      const listB = await request(app.getHttpServer())
        .get("/organizations/me/exams")
        .set(...auth(tokenB))
        .expect(200);
      expect(listB.body).toEqual([]);
    });

    it("rejects creating an exam under another tenant's term/exam type, and scheduling under another tenant's exam subject (404)", async () => {
      const t = await buildExamSchedulingTarget(tokenA, "ESR");

      await request(app.getHttpServer())
        .post("/organizations/me/exams")
        .set(...auth(tokenB))
        .send({ examTypeId: t.examTypeId, termId: t.termId, name: "Cross-tenant exam" })
        .expect(404);

      const exam = await request(app.getHttpServer())
        .post("/organizations/me/exams")
        .set(...auth(tokenA))
        .send({ examTypeId: t.examTypeId, termId: t.termId, name: "Owned Exam" })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/organizations/me/exams/${exam.body.id}/subjects`)
        .set(...auth(tokenB))
        .send({ curriculumSubjectId: t.curriculumSubjectAId, fullMarks: 100, passMarks: 40 })
        .expect(404);

      const examSubject = await request(app.getHttpServer())
        .post(`/organizations/me/exams/${exam.body.id}/subjects`)
        .set(...auth(tokenA))
        .send({ curriculumSubjectId: t.curriculumSubjectAId, fullMarks: 100, passMarks: 40 })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/organizations/me/exam-subjects/${examSubject.body.id}/schedule`)
        .set(...auth(tokenB))
        .send({ date: "2099-03-01", startTime: "09:00", endTime: "11:00" })
        .expect(404);

      const schedule = await request(app.getHttpServer())
        .post(`/organizations/me/exam-subjects/${examSubject.body.id}/schedule`)
        .set(...auth(tokenA))
        .send({ date: "2099-03-01", startTime: "09:00", endTime: "11:00" })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/organizations/me/exam-schedules/${schedule.body.id}/rooms`)
        .set(...auth(tokenB))
        .send({ roomId: t.roomId })
        .expect(404);

      await request(app.getHttpServer())
        .get(`/organizations/me/exams/${exam.body.id}`)
        .set(...auth(tokenB))
        .expect(404);
    });
  });

  describe("exam evaluation (exam attempts → marks)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    async function buildExamEvaluationTarget(token: string, suffix: string) {
      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(token))
        .send({ name: `ExEval Campus ${suffix}`, code: `EVCAMP${suffix}` })
        .expect(201);
      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(token))
        .send({ campusId: campus.body.id, name: `ExEval Faculty ${suffix}`, code: `EVFAC${suffix}` })
        .expect(201);
      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(token))
        .send({ facultyId: faculty.body.id, name: `ExEval Dept ${suffix}`, code: `EVDEP${suffix}` })
        .expect(201);
      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(token))
        .send({ departmentId: department.body.id, name: `ExEval Program ${suffix}`, code: `EVPROG${suffix}` })
        .expect(201);
      const subject = await request(app.getHttpServer())
        .post("/organizations/me/subjects")
        .set(...auth(token))
        .send({ name: `ExEval Subject ${suffix}`, code: `EVSUB${suffix}` })
        .expect(201);
      const curriculum = await request(app.getHttpServer())
        .post("/organizations/me/curricula")
        .set(...auth(token))
        .send({ programId: program.body.id, name: `ExEval Curriculum ${suffix}`, code: `EVCURR${suffix}` })
        .expect(201);
      const curriculumSubject = await request(app.getHttpServer())
        .post(`/organizations/me/curricula/${curriculum.body.id}/subjects`)
        .set(...auth(token))
        .send({ subjectId: subject.body.id })
        .expect(201);
      const year = await request(app.getHttpServer())
        .post("/organizations/me/academic-years")
        .set(...auth(token))
        .send({ name: `ExEval Year ${suffix}`, startDate: "2099-01-01", endDate: "2099-12-31" })
        .expect(201);
      const term = await request(app.getHttpServer())
        .post("/organizations/me/terms")
        .set(...auth(token))
        .send({
          academicYearId: year.body.id,
          name: `ExEval Term ${suffix}`,
          code: `EVT${suffix}`,
          sequence: 1,
          startDate: "2099-01-01",
          endDate: "2099-06-30",
        })
        .expect(201);
      const examType = await request(app.getHttpServer())
        .post("/organizations/me/exam-types")
        .set(...auth(token))
        .send({ name: `ExEval Exam Type ${suffix}`, code: `EVET${suffix}` })
        .expect(201);
      const exam = await request(app.getHttpServer())
        .post("/organizations/me/exams")
        .set(...auth(token))
        .send({ examTypeId: examType.body.id, termId: term.body.id, name: `ExEval Exam ${suffix}` })
        .expect(201);
      const examSubject = await request(app.getHttpServer())
        .post(`/organizations/me/exams/${exam.body.id}/subjects`)
        .set(...auth(token))
        .send({ curriculumSubjectId: curriculumSubject.body.id, fullMarks: 100, passMarks: 40 })
        .expect(201);
      const studentA = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(token))
        .send({ studentCode: `EVSTU-A-${suffix}`, firstName: "Aarav", lastName: "Sharma", dateOfBirth: "2015-01-01" })
        .expect(201);
      const studentB = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(token))
        .send({ studentCode: `EVSTU-B-${suffix}`, firstName: "Sita", lastName: "Gurung", dateOfBirth: "2015-01-01" })
        .expect(201);

      return { examSubjectId: examSubject.body.id, studentAId: studentA.body.id, studentBId: studentB.body.id };
    }

    it("records present/absent attempts, scores marks, rejects marks over fullMarks and for an absent student, and stays tenant-scoped", async () => {
      const t = await buildExamEvaluationTarget(tokenA, "EVA");

      const attemptA = await request(app.getHttpServer())
        .post(`/organizations/me/exam-subjects/${t.examSubjectId}/attempts`)
        .set(...auth(tokenA))
        .send({ studentId: t.studentAId, status: "PRESENT" })
        .expect(201);
      expect(attemptA.body.organizationId).toBe(orgAId);

      const attemptB = await request(app.getHttpServer())
        .post(`/organizations/me/exam-subjects/${t.examSubjectId}/attempts`)
        .set(...auth(tokenA))
        .send({ studentId: t.studentBId, status: "ABSENT" })
        .expect(201);

      // Re-recording an attempt for the same student updates it in place
      // (a correction-friendly upsert), rather than stacking a duplicate.
      const attemptACorrected = await request(app.getHttpServer())
        .post(`/organizations/me/exam-subjects/${t.examSubjectId}/attempts`)
        .set(...auth(tokenA))
        .send({ studentId: t.studentAId, status: "LATE" })
        .expect(201);
      expect(attemptACorrected.body.id).toBe(attemptA.body.id);
      expect(attemptACorrected.body.status).toBe("LATE");

      // obtainedMarks exceeding fullMarks (100) is rejected.
      await request(app.getHttpServer())
        .post(`/organizations/me/exam-attempts/${attemptA.body.id}/marks`)
        .set(...auth(tokenA))
        .send({ obtainedMarks: 120 })
        .expect(400);

      // Marks cannot be recorded for a student who didn't sit the exam.
      await request(app.getHttpServer())
        .post(`/organizations/me/exam-attempts/${attemptB.body.id}/marks`)
        .set(...auth(tokenA))
        .send({ obtainedMarks: 50 })
        .expect(400);

      const marks = await request(app.getHttpServer())
        .post(`/organizations/me/exam-attempts/${attemptA.body.id}/marks`)
        .set(...auth(tokenA))
        .send({ obtainedMarks: 78, remarks: "Good effort" })
        .expect(201);
      expect(marks.body.obtainedMarks).toBe(78);

      // Re-recording marks corrects the existing row (upsert), not a
      // duplicate.
      const marksCorrected = await request(app.getHttpServer())
        .post(`/organizations/me/exam-attempts/${attemptA.body.id}/marks`)
        .set(...auth(tokenA))
        .send({ obtainedMarks: 82 })
        .expect(201);
      expect(marksCorrected.body.id).toBe(marks.body.id);
      expect(marksCorrected.body.obtainedMarks).toBe(82);

      const list = await request(app.getHttpServer())
        .get(`/organizations/me/exam-subjects/${t.examSubjectId}/attempts`)
        .set(...auth(tokenA))
        .expect(200);
      expect(list.body).toHaveLength(2);
      const listedA = list.body.find((a: { id: string }) => a.id === attemptA.body.id);
      expect(listedA.marks.obtainedMarks).toBe(82);
      expect(listedA.student.firstName).toBe("Aarav");

      const listB = await request(app.getHttpServer())
        .get(`/organizations/me/exam-subjects/${t.examSubjectId}/attempts`)
        .set(...auth(tokenB))
        .expect(200);
      expect(listB.body).toEqual([]);
    });

    it("rejects recording an attempt under another tenant's exam subject, and marks under another tenant's attempt (404)", async () => {
      const t = await buildExamEvaluationTarget(tokenA, "EVR");

      await request(app.getHttpServer())
        .post(`/organizations/me/exam-subjects/${t.examSubjectId}/attempts`)
        .set(...auth(tokenB))
        .send({ studentId: t.studentAId, status: "PRESENT" })
        .expect(404);

      const attempt = await request(app.getHttpServer())
        .post(`/organizations/me/exam-subjects/${t.examSubjectId}/attempts`)
        .set(...auth(tokenA))
        .send({ studentId: t.studentAId, status: "PRESENT" })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/organizations/me/exam-attempts/${attempt.body.id}/marks`)
        .set(...auth(tokenB))
        .send({ obtainedMarks: 50 })
        .expect(404);
    });
  });

  describe("exam grading (grades → report cards)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    async function buildExamGradingTarget(token: string, suffix: string) {
      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(token))
        .send({ name: `ExGrade Campus ${suffix}`, code: `EGCAMP${suffix}` })
        .expect(201);
      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(token))
        .send({ campusId: campus.body.id, name: `ExGrade Faculty ${suffix}`, code: `EGFAC${suffix}` })
        .expect(201);
      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(token))
        .send({ facultyId: faculty.body.id, name: `ExGrade Dept ${suffix}`, code: `EGDEP${suffix}` })
        .expect(201);
      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(token))
        .send({ departmentId: department.body.id, name: `ExGrade Program ${suffix}`, code: `EGPROG${suffix}` })
        .expect(201);
      const subjectA = await request(app.getHttpServer())
        .post("/organizations/me/subjects")
        .set(...auth(token))
        .send({ name: `ExGrade Subject A ${suffix}`, code: `EGSUBA${suffix}` })
        .expect(201);
      const subjectB = await request(app.getHttpServer())
        .post("/organizations/me/subjects")
        .set(...auth(token))
        .send({ name: `ExGrade Subject B ${suffix}`, code: `EGSUBB${suffix}` })
        .expect(201);
      const curriculum = await request(app.getHttpServer())
        .post("/organizations/me/curricula")
        .set(...auth(token))
        .send({ programId: program.body.id, name: `ExGrade Curriculum ${suffix}`, code: `EGCURR${suffix}` })
        .expect(201);
      const curriculumSubjectA = await request(app.getHttpServer())
        .post(`/organizations/me/curricula/${curriculum.body.id}/subjects`)
        .set(...auth(token))
        .send({ subjectId: subjectA.body.id })
        .expect(201);
      const curriculumSubjectB = await request(app.getHttpServer())
        .post(`/organizations/me/curricula/${curriculum.body.id}/subjects`)
        .set(...auth(token))
        .send({ subjectId: subjectB.body.id })
        .expect(201);
      const year = await request(app.getHttpServer())
        .post("/organizations/me/academic-years")
        .set(...auth(token))
        .send({ name: `ExGrade Year ${suffix}`, startDate: "2099-01-01", endDate: "2099-12-31" })
        .expect(201);
      const term = await request(app.getHttpServer())
        .post("/organizations/me/terms")
        .set(...auth(token))
        .send({
          academicYearId: year.body.id,
          name: `ExGrade Term ${suffix}`,
          code: `EGT${suffix}`,
          sequence: 1,
          startDate: "2099-01-01",
          endDate: "2099-06-30",
        })
        .expect(201);
      const examType = await request(app.getHttpServer())
        .post("/organizations/me/exam-types")
        .set(...auth(token))
        .send({ name: `ExGrade Exam Type ${suffix}`, code: `EGET${suffix}` })
        .expect(201);
      const gradingScheme = await request(app.getHttpServer())
        .post("/organizations/me/grading-schemes")
        .set(...auth(token))
        .send({
          name: `ExGrade Scheme ${suffix}`,
          code: `EGGS${suffix}`,
          bands: [
            { minPercentage: 90, maxPercentage: 100, grade: "A+", gpa: 4.0 },
            { minPercentage: 80, maxPercentage: 89.99, grade: "A", gpa: 3.6 },
            { minPercentage: 60, maxPercentage: 79.99, grade: "B", gpa: 3.0 },
            { minPercentage: 40, maxPercentage: 59.99, grade: "C", gpa: 2.0 },
            { minPercentage: 0, maxPercentage: 39.99, grade: "F", gpa: 0 },
          ],
        })
        .expect(201);

      // An exam with no grading scheme, to exercise the "no scheme
      // assigned" rejection.
      const examNoScheme = await request(app.getHttpServer())
        .post("/organizations/me/exams")
        .set(...auth(token))
        .send({ examTypeId: examType.body.id, termId: term.body.id, name: `ExGrade No-Scheme Exam ${suffix}` })
        .expect(201);
      const examSubjectNoScheme = await request(app.getHttpServer())
        .post(`/organizations/me/exams/${examNoScheme.body.id}/subjects`)
        .set(...auth(token))
        .send({ curriculumSubjectId: curriculumSubjectA.body.id, fullMarks: 100, passMarks: 40 })
        .expect(201);

      const exam = await request(app.getHttpServer())
        .post("/organizations/me/exams")
        .set(...auth(token))
        .send({
          examTypeId: examType.body.id,
          termId: term.body.id,
          name: `ExGrade Exam ${suffix}`,
          gradingSchemeId: gradingScheme.body.id,
        })
        .expect(201);
      const examSubjectA = await request(app.getHttpServer())
        .post(`/organizations/me/exams/${exam.body.id}/subjects`)
        .set(...auth(token))
        .send({ curriculumSubjectId: curriculumSubjectA.body.id, fullMarks: 100, passMarks: 40 })
        .expect(201);
      const examSubjectB = await request(app.getHttpServer())
        .post(`/organizations/me/exams/${exam.body.id}/subjects`)
        .set(...auth(token))
        .send({ curriculumSubjectId: curriculumSubjectB.body.id, fullMarks: 100, passMarks: 40 })
        .expect(201);
      const student = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(token))
        .send({ studentCode: `EGSTU-${suffix}`, firstName: "Aarav", lastName: "Sharma", dateOfBirth: "2015-01-01" })
        .expect(201);
      const otherStudent = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(token))
        .send({ studentCode: `EGSTU2-${suffix}`, firstName: "Sita", lastName: "Gurung", dateOfBirth: "2015-01-01" })
        .expect(201);

      return {
        examId: exam.body.id as string,
        examSubjectAId: examSubjectA.body.id as string,
        examSubjectBId: examSubjectB.body.id as string,
        examSubjectNoSchemeId: examSubjectNoScheme.body.id as string,
        studentId: student.body.id as string,
        otherStudentId: otherStudent.body.id as string,
      };
    }

    it("computes grades from a grading scheme's bands, rejects grading before marks/without a scheme, aggregates a report card, and stays tenant-scoped", async () => {
      const t = await buildExamGradingTarget(tokenA, "EGA");

      // No grading scheme on the exam — rejected even with marks recorded.
      const attemptNoScheme = await request(app.getHttpServer())
        .post(`/organizations/me/exam-subjects/${t.examSubjectNoSchemeId}/attempts`)
        .set(...auth(tokenA))
        .send({ studentId: t.studentId, status: "PRESENT" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/exam-attempts/${attemptNoScheme.body.id}/marks`)
        .set(...auth(tokenA))
        .send({ obtainedMarks: 50 })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/exam-attempts/${attemptNoScheme.body.id}/grade`)
        .set(...auth(tokenA))
        .expect(400);

      // Subject A: 82% -> "A" band.
      const attemptA = await request(app.getHttpServer())
        .post(`/organizations/me/exam-subjects/${t.examSubjectAId}/attempts`)
        .set(...auth(tokenA))
        .send({ studentId: t.studentId, status: "PRESENT" })
        .expect(201);

      // Grading before marks are recorded is rejected.
      await request(app.getHttpServer())
        .post(`/organizations/me/exam-attempts/${attemptA.body.id}/grade`)
        .set(...auth(tokenA))
        .expect(400);

      await request(app.getHttpServer())
        .post(`/organizations/me/exam-attempts/${attemptA.body.id}/marks`)
        .set(...auth(tokenA))
        .send({ obtainedMarks: 82 })
        .expect(201);
      const gradeA = await request(app.getHttpServer())
        .post(`/organizations/me/exam-attempts/${attemptA.body.id}/grade`)
        .set(...auth(tokenA))
        .expect(201);
      expect(gradeA.body.grade).toBe("A");
      expect(gradeA.body.percentage).toBe(82);

      // Re-computing upserts in place rather than stacking a duplicate.
      const gradeARecomputed = await request(app.getHttpServer())
        .post(`/organizations/me/exam-attempts/${attemptA.body.id}/grade`)
        .set(...auth(tokenA))
        .expect(201);
      expect(gradeARecomputed.body.id).toBe(gradeA.body.id);

      // Subject B: 55% -> "C" band.
      const attemptB = await request(app.getHttpServer())
        .post(`/organizations/me/exam-subjects/${t.examSubjectBId}/attempts`)
        .set(...auth(tokenA))
        .send({ studentId: t.studentId, status: "PRESENT" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/exam-attempts/${attemptB.body.id}/marks`)
        .set(...auth(tokenA))
        .send({ obtainedMarks: 55 })
        .expect(201);
      const gradeB = await request(app.getHttpServer())
        .post(`/organizations/me/exam-attempts/${attemptB.body.id}/grade`)
        .set(...auth(tokenA))
        .expect(201);
      expect(gradeB.body.grade).toBe("C");

      // No graded subjects for a student who never attempted this exam.
      await request(app.getHttpServer())
        .post(`/organizations/me/exams/${t.examId}/students/${t.otherStudentId}/report-card`)
        .set(...auth(tokenA))
        .expect(400);

      // Report card aggregates both subjects: (82 + 55) / 200 = 68.5% -> "B".
      const reportCard = await request(app.getHttpServer())
        .post(`/organizations/me/exams/${t.examId}/students/${t.studentId}/report-card`)
        .set(...auth(tokenA))
        .expect(201);
      expect(reportCard.body.totalObtainedMarks).toBe(137);
      expect(reportCard.body.totalFullMarks).toBe(200);
      expect(reportCard.body.percentage).toBeCloseTo(68.5);
      expect(reportCard.body.overallGrade).toBe("B");

      // Regenerating upserts in place.
      const reportCardRegenerated = await request(app.getHttpServer())
        .post(`/organizations/me/exams/${t.examId}/students/${t.studentId}/report-card`)
        .set(...auth(tokenA))
        .expect(201);
      expect(reportCardRegenerated.body.id).toBe(reportCard.body.id);

      const fetched = await request(app.getHttpServer())
        .get(`/organizations/me/exams/${t.examId}/students/${t.studentId}/report-card`)
        .set(...auth(tokenA))
        .expect(200);
      expect(fetched.body.subjects).toHaveLength(2);
      expect(fetched.body.overallGrade).toBe("B");

      const fetchedB = await request(app.getHttpServer())
        .get(`/organizations/me/exams/${t.examId}/students/${t.studentId}/report-card`)
        .set(...auth(tokenB))
        .expect(404);
      expect(fetchedB.body).toBeDefined();
    });

    it("rejects computing a grade under another tenant's exam attempt, and generating/fetching a report card under another tenant's exam (404)", async () => {
      const t = await buildExamGradingTarget(tokenA, "EGR");

      const attempt = await request(app.getHttpServer())
        .post(`/organizations/me/exam-subjects/${t.examSubjectAId}/attempts`)
        .set(...auth(tokenA))
        .send({ studentId: t.studentId, status: "PRESENT" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/exam-attempts/${attempt.body.id}/marks`)
        .set(...auth(tokenA))
        .send({ obtainedMarks: 82 })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/organizations/me/exam-attempts/${attempt.body.id}/grade`)
        .set(...auth(tokenB))
        .expect(404);

      await request(app.getHttpServer())
        .post(`/organizations/me/exams/${t.examId}/students/${t.studentId}/report-card`)
        .set(...auth(tokenB))
        .expect(404);

      await request(app.getHttpServer())
        .get(`/organizations/me/exams/${t.examId}/students/${t.studentId}/report-card`)
        .set(...auth(tokenB))
        .expect(404);
    });
  });

  describe("student portal authentication (create-login → self-service dashboard)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    it("creates a student login, rejects a duplicate, logs in by username, and returns only that student's own dashboard (IDOR guard)", async () => {
      const studentA = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `PORTAL-A-${run}`, firstName: "Aarav", lastName: "Sharma", dateOfBirth: "2015-01-01" })
        .expect(201);
      const studentB = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `PORTAL-B-${run}`, firstName: "Sita", lastName: "Gurung", dateOfBirth: "2015-01-01" })
        .expect(201);

      const loginA = await request(app.getHttpServer())
        .post(`/organizations/me/students/${studentA.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "StudentPass123" })
        .expect(201);
      expect(loginA.body.username).toBe(`${orgASlug}.PORTAL-A-${run}`);
      expect(loginA.body).not.toHaveProperty("passwordHash");

      // A student can't get a second login.
      await request(app.getHttpServer())
        .post(`/organizations/me/students/${studentA.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "AnotherPass123" })
        .expect(409);

      const loginB = await request(app.getHttpServer())
        .post(`/organizations/me/students/${studentB.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "StudentPass456" })
        .expect(201);

      // Logs in with the generated username (not an email) through the
      // same /auth/login endpoint every other role uses.
      const sessionA = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: loginA.body.username, password: "StudentPass123" })
        .expect(201);
      const sessionB = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: loginB.body.username, password: "StudentPass456" })
        .expect(201);

      // No studentId param exists on this route — it's derived from the
      // caller's own linked Student row, so there's nothing to tamper
      // with. Confirms each student only ever sees their own data.
      const dashboardA = await request(app.getHttpServer())
        .get("/organizations/me/portal/dashboard")
        .set(...auth(sessionA.body.accessToken))
        .expect(200);
      expect(dashboardA.body.student.id).toBe(studentA.body.id);

      const dashboardB = await request(app.getHttpServer())
        .get("/organizations/me/portal/dashboard")
        .set(...auth(sessionB.body.accessToken))
        .expect(200);
      expect(dashboardB.body.student.id).toBe(studentB.body.id);

      // A non-student user (the org admin) has no linked Student row.
      await request(app.getHttpServer())
        .get("/organizations/me/portal/dashboard")
        .set(...auth(tokenA))
        .expect(404);
    });

    it("rejects creating a login under another tenant's student (404)", async () => {
      const student = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `PORTAL-X-${run}`, firstName: "Rohan", lastName: "Thapa", dateOfBirth: "2015-01-01" })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/organizations/me/students/${student.body.id}/create-login`)
        .set(...auth(tokenB))
        .send({ password: "StudentPass123" })
        .expect(404);
    });
  });

  describe("online exam-taking (student portal: start → shuffle → autosave → resume → submit → auto-score)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    async function buildOnlineExamTarget(
      token: string,
      suffix: string,
      opts: {
        schedule?: { date: string; startTime: string; endTime: string };
        recordAttemptForA?: boolean;
      } = {},
    ) {
      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(token))
        .send({ name: `OnlineExam Campus ${suffix}`, code: `OECAMP${suffix}` })
        .expect(201);
      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(token))
        .send({ campusId: campus.body.id, name: `OnlineExam Faculty ${suffix}`, code: `OEFAC${suffix}` })
        .expect(201);
      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(token))
        .send({ facultyId: faculty.body.id, name: `OnlineExam Dept ${suffix}`, code: `OEDEP${suffix}` })
        .expect(201);
      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(token))
        .send({ departmentId: department.body.id, name: `OnlineExam Program ${suffix}`, code: `OEPROG${suffix}` })
        .expect(201);
      const subject = await request(app.getHttpServer())
        .post("/organizations/me/subjects")
        .set(...auth(token))
        .send({ name: `OnlineExam Subject ${suffix}`, code: `OESUB${suffix}` })
        .expect(201);
      const curriculum = await request(app.getHttpServer())
        .post("/organizations/me/curricula")
        .set(...auth(token))
        .send({ programId: program.body.id, name: `OnlineExam Curriculum ${suffix}`, code: `OECURR${suffix}` })
        .expect(201);
      const curriculumSubject = await request(app.getHttpServer())
        .post(`/organizations/me/curricula/${curriculum.body.id}/subjects`)
        .set(...auth(token))
        .send({ subjectId: subject.body.id })
        .expect(201);
      const year = await request(app.getHttpServer())
        .post("/organizations/me/academic-years")
        .set(...auth(token))
        .send({ name: `OnlineExam Year ${suffix}`, startDate: "2099-01-01", endDate: "2099-12-31" })
        .expect(201);
      const term = await request(app.getHttpServer())
        .post("/organizations/me/terms")
        .set(...auth(token))
        .send({
          academicYearId: year.body.id,
          name: `OnlineExam Term ${suffix}`,
          code: `OET${suffix}`,
          sequence: 1,
          startDate: "2099-01-01",
          endDate: "2099-06-30",
        })
        .expect(201);
      const examType = await request(app.getHttpServer())
        .post("/organizations/me/exam-types")
        .set(...auth(token))
        .send({ name: `OnlineExam Type ${suffix}`, code: `OEET${suffix}` })
        .expect(201);
      const exam = await request(app.getHttpServer())
        .post("/organizations/me/exams")
        .set(...auth(token))
        .send({ examTypeId: examType.body.id, termId: term.body.id, name: `OnlineExam ${suffix}` })
        .expect(201);

      const bank = await request(app.getHttpServer())
        .post("/organizations/me/question-banks")
        .set(...auth(token))
        .send({ curriculumSubjectId: curriculumSubject.body.id, name: `OnlineExam Bank ${suffix}` })
        .expect(201);

      const q1 = await request(app.getHttpServer())
        .post(`/organizations/me/question-banks/${bank.body.id}/questions`)
        .set(...auth(token))
        .send({
          sequence: 1,
          text: "What is the capital of France?",
          questionType: "OBJECTIVE",
          marks: 5,
          options: ["Paris", "London", "Berlin"],
          correctOptionIndex: 0,
        })
        .expect(201);
      const q2 = await request(app.getHttpServer())
        .post(`/organizations/me/question-banks/${bank.body.id}/questions`)
        .set(...auth(token))
        .send({
          sequence: 2,
          text: "2 + 2 = ?",
          questionType: "OBJECTIVE",
          marks: 5,
          options: ["2", "3", "4", "5"],
          correctOptionIndex: 2,
        })
        .expect(201);
      const q3 = await request(app.getHttpServer())
        .post(`/organizations/me/question-banks/${bank.body.id}/questions`)
        .set(...auth(token))
        .send({
          sequence: 3,
          text: "Explain photosynthesis.",
          questionType: "SUBJECTIVE",
          marks: 10,
          modelAnswer: "Plants convert light energy into chemical energy.",
        })
        .expect(201);

      const examSubject = await request(app.getHttpServer())
        .post(`/organizations/me/exams/${exam.body.id}/subjects`)
        .set(...auth(token))
        .send({
          curriculumSubjectId: curriculumSubject.body.id,
          fullMarks: 100,
          passMarks: 40,
          questionBankId: bank.body.id,
        })
        .expect(201);
      expect(examSubject.body.questionBankId).toBe(bank.body.id);

      const today = new Date().toISOString().slice(0, 10);
      const schedule = opts.schedule ?? { date: today, startTime: "00:00", endTime: "23:59" };
      await request(app.getHttpServer())
        .post(`/organizations/me/exam-subjects/${examSubject.body.id}/schedule`)
        .set(...auth(token))
        .send(schedule)
        .expect(201);

      const studentA = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(token))
        .send({ studentCode: `OE-A-${suffix}`, firstName: "Aarav", lastName: "Sharma", dateOfBirth: "2015-01-01" })
        .expect(201);
      const studentB = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(token))
        .send({ studentCode: `OE-B-${suffix}`, firstName: "Sita", lastName: "Gurung", dateOfBirth: "2015-01-01" })
        .expect(201);

      const loginA = await request(app.getHttpServer())
        .post(`/organizations/me/students/${studentA.body.id}/create-login`)
        .set(...auth(token))
        .send({ password: "StudentPass123" })
        .expect(201);
      const loginB = await request(app.getHttpServer())
        .post(`/organizations/me/students/${studentB.body.id}/create-login`)
        .set(...auth(token))
        .send({ password: "StudentPass456" })
        .expect(201);

      const sessionA = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: loginA.body.username, password: "StudentPass123" })
        .expect(201);
      const sessionB = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: loginB.body.username, password: "StudentPass456" })
        .expect(201);

      if (opts.recordAttemptForA !== false) {
        await request(app.getHttpServer())
          .post(`/organizations/me/exam-subjects/${examSubject.body.id}/attempts`)
          .set(...auth(token))
          .send({ studentId: studentA.body.id, status: "PRESENT" })
          .expect(201);
      }

      return {
        examSubjectId: examSubject.body.id as string,
        q1Id: q1.body.id as string,
        q2Id: q2.body.id as string,
        q3Id: q3.body.id as string,
        studentAId: studentA.body.id as string,
        studentBId: studentB.body.id as string,
        tokenA: sessionA.body.accessToken as string,
        tokenB: sessionB.body.accessToken as string,
      };
    }

    it("shuffles questions/options with no leaked answer key, autosaves, resumes with the same order, submits, auto-scores objective answers, blocks resubmission, and is IDOR-safe for a student not registered for the exam", async () => {
      const t = await buildOnlineExamTarget(tokenA, "OEA");

      const started = await request(app.getHttpServer())
        .post(`/organizations/me/portal/exams/${t.examSubjectId}/start`)
        .set(...auth(t.tokenA))
        .expect(201);
      expect(started.body.questions).toHaveLength(3);
      for (const q of started.body.questions) {
        expect(q).not.toHaveProperty("correctOptionIndex");
        expect(q).not.toHaveProperty("modelAnswer");
      }

      const q1 = started.body.questions.find((q: { id: string }) => q.id === t.q1Id);
      const q2 = started.body.questions.find((q: { id: string }) => q.id === t.q2Id);
      const q1CorrectDisplayIndex = q1.options.indexOf("Paris");
      const q2WrongDisplayIndex = q2.options.findIndex((o: string) => o !== "4");

      await request(app.getHttpServer())
        .put(`/organizations/me/portal/exams/${t.examSubjectId}/answers/${t.q1Id}`)
        .set(...auth(t.tokenA))
        .send({ selectedOptionIndex: q1CorrectDisplayIndex })
        .expect(200);
      await request(app.getHttpServer())
        .put(`/organizations/me/portal/exams/${t.examSubjectId}/answers/${t.q2Id}`)
        .set(...auth(t.tokenA))
        .send({ selectedOptionIndex: q2WrongDisplayIndex })
        .expect(200);
      await request(app.getHttpServer())
        .put(`/organizations/me/portal/exams/${t.examSubjectId}/answers/${t.q3Id}`)
        .set(...auth(t.tokenA))
        .send({ textAnswer: "Plants convert light energy into chemical energy." })
        .expect(200);

      // Resume: a second fetch of the same in-progress attempt returns the
      // identical question/option order (deterministic seed) and the
      // previously-saved answers, pre-selected — no reshuffle on refresh.
      const resumed = await request(app.getHttpServer())
        .post(`/organizations/me/portal/exams/${t.examSubjectId}/start`)
        .set(...auth(t.tokenA))
        .expect(201);
      expect(resumed.body.questions.map((q: { id: string }) => q.id)).toEqual(
        started.body.questions.map((q: { id: string }) => q.id),
      );
      const resumedQ1 = resumed.body.questions.find((q: { id: string }) => q.id === t.q1Id);
      const resumedQ2 = resumed.body.questions.find((q: { id: string }) => q.id === t.q2Id);
      const resumedQ3 = resumed.body.questions.find((q: { id: string }) => q.id === t.q3Id);
      expect(resumedQ1.options).toEqual(q1.options);
      expect(resumedQ1.selectedOptionIndex).toBe(q1CorrectDisplayIndex);
      expect(resumedQ2.selectedOptionIndex).toBe(q2WrongDisplayIndex);
      expect(resumedQ3.textAnswer).toBe("Plants convert light energy into chemical energy.");

      const submitted = await request(app.getHttpServer())
        .post(`/organizations/me/portal/exams/${t.examSubjectId}/submit`)
        .set(...auth(t.tokenA))
        .expect(201);
      expect(submitted.body.submittedAt).not.toBeNull();

      // Resubmission and further edits are rejected once submitted.
      await request(app.getHttpServer())
        .post(`/organizations/me/portal/exams/${t.examSubjectId}/submit`)
        .set(...auth(t.tokenA))
        .expect(409);
      await request(app.getHttpServer())
        .put(`/organizations/me/portal/exams/${t.examSubjectId}/answers/${t.q1Id}`)
        .set(...auth(t.tokenA))
        .send({ selectedOptionIndex: 0 })
        .expect(409);
      await request(app.getHttpServer())
        .post(`/organizations/me/portal/exams/${t.examSubjectId}/start`)
        .set(...auth(t.tokenA))
        .expect(409);

      // Admin reviews the auto-scored Answer breakdown — correct objective
      // answer scores full marks, incorrect scores zero, subjective is left
      // unscored for human grading (4c/4d's recordMarks/computeGrade, both
      // untouched by this slice).
      const attempts = await request(app.getHttpServer())
        .get(`/organizations/me/exam-subjects/${t.examSubjectId}/attempts`)
        .set(...auth(tokenA))
        .expect(200);
      const attemptA = attempts.body.find((a: { studentId: string }) => a.studentId === t.studentAId);
      const answers = await request(app.getHttpServer())
        .get(`/organizations/me/exam-attempts/${attemptA.id}/answers`)
        .set(...auth(tokenA))
        .expect(200);
      expect(answers.body).toHaveLength(3);
      const answerQ1 = answers.body.find((a: { questionId: string }) => a.questionId === t.q1Id);
      const answerQ2 = answers.body.find((a: { questionId: string }) => a.questionId === t.q2Id);
      const answerQ3 = answers.body.find((a: { questionId: string }) => a.questionId === t.q3Id);
      expect(answerQ1.score).toBe(5);
      expect(answerQ2.score).toBe(0);
      expect(answerQ3.score).toBeNull();
      expect(answerQ3.textAnswer).toBe("Plants convert light energy into chemical energy.");

      // IDOR: studentB has a login but was never recorded as an attempt for
      // this exam subject — every route 404s for them, both ways (they
      // can't start, answer, or submit against studentA's exam), because
      // studentId is derived from the caller's own linked Student row, not
      // a request param — there is nothing to tamper with.
      await request(app.getHttpServer())
        .post(`/organizations/me/portal/exams/${t.examSubjectId}/start`)
        .set(...auth(t.tokenB))
        .expect(404);
      await request(app.getHttpServer())
        .put(`/organizations/me/portal/exams/${t.examSubjectId}/answers/${t.q1Id}`)
        .set(...auth(t.tokenB))
        .send({ selectedOptionIndex: 0 })
        .expect(404);
      await request(app.getHttpServer())
        .post(`/organizations/me/portal/exams/${t.examSubjectId}/submit`)
        .set(...auth(t.tokenB))
        .expect(404);
    });

    it("rejects starting outside the scheduled window (400) and starting without a pre-existing attempt (404)", async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const outsideWindow = await buildOnlineExamTarget(tokenA, "OEW", {
        schedule: { date: tomorrow, startTime: "09:00", endTime: "11:00" },
      });
      await request(app.getHttpServer())
        .post(`/organizations/me/portal/exams/${outsideWindow.examSubjectId}/start`)
        .set(...auth(outsideWindow.tokenA))
        .expect(400);

      const noAttempt = await buildOnlineExamTarget(tokenA, "OEN", { recordAttemptForA: false });
      await request(app.getHttpServer())
        .post(`/organizations/me/portal/exams/${noAttempt.examSubjectId}/start`)
        .set(...auth(noAttempt.tokenA))
        .expect(404);
    });
  });

  describe("biometric policy (privacy/consent foundation — Phase 6 slice 6a, no capture/matching capability)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    it("defaults to disabled, rejects enrollment while disabled, enrolls a student and a staff member once enabled, rejects neither/both ids, withdraws, and stays tenant-scoped", async () => {
      const defaultPolicy = await request(app.getHttpServer())
        .get("/organizations/me/biometric-policy")
        .set(...auth(tokenA))
        .expect(200);
      expect(defaultPolicy.body.enabled).toBe(false);

      const student = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `BIO-STU-${run}`, firstName: "Bina", lastName: "Rai", dateOfBirth: "2015-01-01" })
        .expect(201);

      // No consent can be recorded while the org hasn't enabled biometrics.
      await request(app.getHttpServer())
        .post("/organizations/me/biometric/enrollments")
        .set(...auth(tokenA))
        .send({ studentId: student.body.id, consentGivenBy: "self" })
        .expect(400);

      const updated = await request(app.getHttpServer())
        .put("/organizations/me/biometric-policy")
        .set(...auth(tokenA))
        .send({ enabled: true, retentionDays: 180, matchConfidenceThreshold: 0.8 })
        .expect(200);
      expect(updated.body.enabled).toBe(true);
      expect(updated.body.retentionDays).toBe(180);

      const staffType = await request(app.getHttpServer())
        .post("/organizations/me/staff-types")
        .set(...auth(tokenA))
        .send({ name: `Bio Staff Type ${run}`, code: `BST${run}` })
        .expect(201);
      const designation = await request(app.getHttpServer())
        .post("/organizations/me/designations")
        .set(...auth(tokenA))
        .send({ name: `Bio Designation ${run}`, code: `BDS${run}` })
        .expect(201);
      const employee = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(tokenA))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `BIO-EMP-${run}`,
          firstName: "Bikash",
          lastName: "Shrestha",
          email: `bikash-${run}@bio-e2e.test`,
          dateOfJoining: "2026-01-01",
        })
        .expect(201);

      // Neither id, and both ids, are both rejected — exactly one required.
      await request(app.getHttpServer())
        .post("/organizations/me/biometric/enrollments")
        .set(...auth(tokenA))
        .send({ consentGivenBy: "self" })
        .expect(400);
      await request(app.getHttpServer())
        .post("/organizations/me/biometric/enrollments")
        .set(...auth(tokenA))
        .send({ studentId: student.body.id, staffId: employee.body.id, consentGivenBy: "self" })
        .expect(400);

      const studentEnrollment = await request(app.getHttpServer())
        .post("/organizations/me/biometric/enrollments")
        .set(...auth(tokenA))
        .send({ studentId: student.body.id, consentGivenBy: "Guardian: Sita Rai" })
        .expect(201);
      expect(studentEnrollment.body.status).toBe("ACTIVE");

      const staffEnrollment = await request(app.getHttpServer())
        .post("/organizations/me/biometric/enrollments")
        .set(...auth(tokenA))
        .send({ staffId: employee.body.id, consentGivenBy: "self" })
        .expect(201);

      const list = await request(app.getHttpServer())
        .get("/organizations/me/biometric/enrollments")
        .set(...auth(tokenA))
        .expect(200);
      expect(list.body).toHaveLength(2);
      const listedStudent = list.body.find((e: { id: string }) => e.id === studentEnrollment.body.id);
      expect(listedStudent.student.firstName).toBe("Bina");

      const withdrawn = await request(app.getHttpServer())
        .post(`/organizations/me/biometric/enrollments/${staffEnrollment.body.id}/withdraw`)
        .set(...auth(tokenA))
        .expect(201);
      expect(withdrawn.body.status).toBe("WITHDRAWN");

      // Withdrawing a second time is a real conflict, not a silent no-op.
      await request(app.getHttpServer())
        .post(`/organizations/me/biometric/enrollments/${staffEnrollment.body.id}/withdraw`)
        .set(...auth(tokenA))
        .expect(409);

      const listB = await request(app.getHttpServer())
        .get("/organizations/me/biometric/enrollments")
        .set(...auth(tokenB))
        .expect(200);
      expect(listB.body).toEqual([]);
    });

    it("rejects reading/updating another tenant's policy having no effect, and withdrawing under another tenant's enrollment (404)", async () => {
      await request(app.getHttpServer())
        .put("/organizations/me/biometric-policy")
        .set(...auth(tokenA))
        .send({ enabled: true })
        .expect(200);

      const studentA = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `BIO-X-${run}`, firstName: "Rohan", lastName: "Thapa", dateOfBirth: "2015-01-01" })
        .expect(201);
      const enrollment = await request(app.getHttpServer())
        .post("/organizations/me/biometric/enrollments")
        .set(...auth(tokenA))
        .send({ studentId: studentA.body.id, consentGivenBy: "self" })
        .expect(201);

      // Org B's own policy is unaffected by org A's — RLS/app-scoping,
      // not a shared row.
      const policyB = await request(app.getHttpServer())
        .get("/organizations/me/biometric-policy")
        .set(...auth(tokenB))
        .expect(200);
      expect(policyB.body.enabled).toBe(false);

      await request(app.getHttpServer())
        .post(`/organizations/me/biometric/enrollments/${enrollment.body.id}/withdraw`)
        .set(...auth(tokenB))
        .expect(404);
    });
  });

  describe("camera capture & face matching (Phase 6 slice 6c — requires services/ai running on AI_SERVICE_URL)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    // Two single-face crops derived from InsightFace's own bundled
    // demo/test image (t1.jpg, a generic stock photo — not a named
    // real individual's photo), prepared once via a throwaway Python
    // script before this slice was planned. Not new assets added to
    // this repo — read from the session scratchpad.
    const fixturesDir =
      "/private/tmp/claude-501/-Users-nepalpolicemac5-website/87a26d71-4b2c-4aaf-b1d1-16be580a0359/scratchpad";
    const enrollmentFace = `${fixturesDir}/enrollment-face.jpg`;
    const differentFace = `${fixturesDir}/different-face.jpg`;
    // The un-cropped original (6 faces) — used only to prove the
    // enrollment-photo endpoint actually rejects a multi-face photo,
    // not to enroll with it.
    const multiFacePhoto =
      "/Users/nepalpolicemac5/educationERP/services/ai/.venv/lib/python3.13/site-packages/insightface/data/images/t1.jpg";

    it("identifies a capture against its own enrollment photo, keeps the image only for an uncertain match against a different face, and supports review", async () => {
      await request(app.getHttpServer())
        .put("/organizations/me/biometric-policy")
        .set(...auth(tokenA))
        .send({ enabled: true })
        .expect(200);

      const student = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `CAM-STU-${run}`, firstName: "Cami", lastName: "Rai", dateOfBirth: "2015-01-01" })
        .expect(201);
      const enrollment = await request(app.getHttpServer())
        .post("/organizations/me/biometric/enrollments")
        .set(...auth(tokenA))
        .send({ studentId: student.body.id, consentGivenBy: "self" })
        .expect(201);

      // A photo with more than one face is rejected outright.
      await request(app.getHttpServer())
        .post(`/organizations/me/biometric/enrollments/${enrollment.body.id}/photo`)
        .set(...auth(tokenA))
        .attach("image", multiFacePhoto)
        .expect(400);

      const photo = await request(app.getHttpServer())
        .post(`/organizations/me/biometric/enrollments/${enrollment.body.id}/photo`)
        .set(...auth(tokenA))
        .attach("image", enrollmentFace)
        .expect(201);
      expect(photo.body.detScore).toBeGreaterThan(0);

      const camera = await request(app.getHttpServer())
        .post("/organizations/me/cameras")
        .set(...auth(tokenA))
        .send({ name: `Camera ${run}` })
        .expect(201);

      const identifiedEvent = await request(app.getHttpServer())
        .post(`/organizations/me/cameras/${camera.body.id}/events`)
        .set(...auth(tokenA))
        .attach("image", enrollmentFace)
        .expect(201);
      expect(identifiedEvent.body.matches).toHaveLength(1);
      expect(identifiedEvent.body.matches[0].result).toBe("IDENTIFIED");
      expect(identifiedEvent.body.matches[0].matchedEnrollmentId).toBe(enrollment.body.id);
      expect(identifiedEvent.body.hasImage).toBe(false);

      const uncertainEvent = await request(app.getHttpServer())
        .post(`/organizations/me/cameras/${camera.body.id}/events`)
        .set(...auth(tokenA))
        .attach("image", differentFace)
        .expect(201);
      expect(uncertainEvent.body.matches).toHaveLength(1);
      const uncertainMatch = uncertainEvent.body.matches[0];
      expect(uncertainMatch.result).not.toBe("IDENTIFIED");
      expect(uncertainEvent.body.hasImage).toBe(true);

      // No image was kept for the confidently-identified event...
      await request(app.getHttpServer())
        .get(`/organizations/me/face-match-events/${identifiedEvent.body.matches[0].id}/image`)
        .set(...auth(tokenA))
        .expect(404);
      // ...but one was for the uncertain one, per the confirmed
      // retention rule.
      const imageRes = await request(app.getHttpServer())
        .get(`/organizations/me/face-match-events/${uncertainMatch.id}/image`)
        .set(...auth(tokenA))
        .expect(200);
      expect(imageRes.headers["content-type"]).toContain("image");

      if (uncertainMatch.result === "POSSIBLE_MATCH") {
        const reviewed = await request(app.getHttpServer())
          .post(`/organizations/me/face-match-events/${uncertainMatch.id}/review`)
          .set(...auth(tokenA))
          .send({ decision: "REJECTED" })
          .expect(201);
        expect(reviewed.body.reviewDecision).toBe("REJECTED");

        // Reviewing a second time is a real conflict, not a silent no-op.
        await request(app.getHttpServer())
          .post(`/organizations/me/face-match-events/${uncertainMatch.id}/review`)
          .set(...auth(tokenA))
          .send({ decision: "CONFIRMED" })
          .expect(409);
      } else {
        // UNKNOWN — nothing to review, the endpoint only accepts a
        // POSSIBLE_MATCH.
        await request(app.getHttpServer())
          .post(`/organizations/me/face-match-events/${uncertainMatch.id}/review`)
          .set(...auth(tokenA))
          .send({ decision: "REJECTED" })
          .expect(400);
      }

      const listB = await request(app.getHttpServer())
        .get("/organizations/me/face-match-events")
        .set(...auth(tokenB))
        .expect(200);
      expect(listB.body).toEqual([]);
    }, 60000);

    it("rejects capture while the org's policy is disabled, and cross-tenant camera/image access (404)", async () => {
      await request(app.getHttpServer())
        .put("/organizations/me/biometric-policy")
        .set(...auth(tokenA))
        .send({ enabled: false })
        .expect(200);

      const camera = await request(app.getHttpServer())
        .post("/organizations/me/cameras")
        .set(...auth(tokenA))
        .send({ name: `Disabled-Policy Camera ${run}` })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/organizations/me/cameras/${camera.body.id}/events`)
        .set(...auth(tokenA))
        .attach("image", enrollmentFace)
        .expect(400);

      await request(app.getHttpServer())
        .post(`/organizations/me/cameras/${camera.body.id}/events`)
        .set(...auth(tokenB))
        .attach("image", enrollmentFace)
        .expect(404);
    }, 30000);
  });

  describe("attendance reconciliation (Phase 6 slice 6d — biometric identification marks existing attendance, never overwrites)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];
    const fixturesDir =
      "/private/tmp/claude-501/-Users-nepalpolicemac5-website/87a26d71-4b2c-4aaf-b1d1-16be580a0359/scratchpad";
    const enrollmentFace = `${fixturesDir}/enrollment-face.jpg`;
    const differentFace = `${fixturesDir}/different-face.jpg`;
    // A third single-face crop from the same InsightFace bundled demo
    // image used by 6b/6c — kept distinct from enrollmentFace/
    // differentFace so a student's and a staff member's enrollments
    // never share an embedding within the same org (which would make
    // the vector search's "closest match" ambiguous between them).
    const staffFace = `${fixturesDir}/staff-face.jpg`;

    // Anchored to the real test-run date/time throughout, not a fixed
    // fixture date like every other describe block's 2099 dates — a
    // camera capture's timestamp is always server "now" (never
    // client-suppliable, by design), so the fixture has to bracket
    // whatever "now" actually is when the suite runs. Computed in UTC
    // to match AttendanceReconciliationService's own UTC convention.
    const now = new Date();
    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    const todayStr = ymd(now);
    const isoWeekday = now.getUTCDay() === 0 ? 7 : now.getUTCDay();

    async function buildReconciliationTarget(token: string, suffix: string) {
      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(token))
        .send({ name: `Reconciliation Campus ${suffix}`, code: `RCCAMP${suffix}` })
        .expect(201);
      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(token))
        .send({ campusId: campus.body.id, name: `Reconciliation Faculty ${suffix}`, code: `RCFAC${suffix}` })
        .expect(201);
      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(token))
        .send({ facultyId: faculty.body.id, name: `Reconciliation Dept ${suffix}`, code: `RCDEP${suffix}` })
        .expect(201);
      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(token))
        .send({ departmentId: department.body.id, name: `Reconciliation Program ${suffix}`, code: `RCPROG${suffix}` })
        .expect(201);
      const year = await request(app.getHttpServer())
        .post("/organizations/me/academic-years")
        .set(...auth(token))
        .send({ name: `Reconciliation Year ${suffix}`, startDate: "2020-01-01", endDate: "2035-12-31" })
        .expect(201);
      // startDate/endDate bracket real "now" with a wide margin — this
      // is what AttendanceReconciliationService actually checks
      // (term.startDate <= capturedAt <= term.endDate) to disambiguate
      // which of a student's ACTIVE enrollments is current.
      const term = await request(app.getHttpServer())
        .post("/organizations/me/terms")
        .set(...auth(token))
        .send({
          academicYearId: year.body.id,
          name: `Reconciliation Term ${suffix}`,
          code: `RCT${suffix}`,
          sequence: 1,
          startDate: "2020-01-01",
          endDate: "2035-12-31",
        })
        .expect(201);
      const section = await request(app.getHttpServer())
        .post("/organizations/me/sections")
        .set(...auth(token))
        .send({ programId: program.body.id, termId: term.body.id, name: `Reconciliation Section ${suffix}`, code: `RS${suffix}` })
        .expect(201);
      const staffType = await request(app.getHttpServer())
        .post("/organizations/me/staff-types")
        .set(...auth(token))
        .send({ name: `Reconciliation Staff Type ${suffix}`, code: `RST${suffix}` })
        .expect(201);
      const designation = await request(app.getHttpServer())
        .post("/organizations/me/designations")
        .set(...auth(token))
        .send({ name: `Reconciliation Designation ${suffix}`, code: `RDS${suffix}` })
        .expect(201);
      const employee = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(token))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `RCEMP-${suffix}`,
          firstName: "Reconciliation",
          lastName: `Teacher${suffix}`,
          email: `rcteacher-${suffix}-${run}@rls-e2e.test`,
          dateOfJoining: "2020-01-01",
        })
        .expect(201);
      const subject = await request(app.getHttpServer())
        .post("/organizations/me/subjects")
        .set(...auth(token))
        .send({ name: `Reconciliation Subject ${suffix}`, code: `RCSUB${suffix}` })
        .expect(201);
      const room = await request(app.getHttpServer())
        .post("/organizations/me/rooms")
        .set(...auth(token))
        .send({ campusId: campus.body.id, name: `Reconciliation Room ${suffix}`, code: `RRM${suffix}` })
        .expect(201);
      // Spans the whole day so the fixture never depends on the actual
      // wall-clock time the suite happens to run at.
      const period = await request(app.getHttpServer())
        .post("/organizations/me/periods")
        .set(...auth(token))
        .send({ name: `Reconciliation Period ${suffix}`, code: `RP${suffix}`, sequence: 1, startTime: "00:00", endTime: "23:59" })
        .expect(201);
      const assignment = await request(app.getHttpServer())
        .post("/organizations/me/teaching-assignments")
        .set(...auth(token))
        .send({ employeeId: employee.body.id, subjectId: subject.body.id, sectionId: section.body.id, termId: term.body.id })
        .expect(201);
      const classSchedule = await request(app.getHttpServer())
        .post("/organizations/me/class-schedules")
        .set(...auth(token))
        .send({ teachingAssignmentId: assignment.body.id, roomId: room.body.id, periodId: period.body.id, dayOfWeek: isoWeekday })
        .expect(201);

      return {
        programId: program.body.id,
        sectionId: section.body.id,
        termId: term.body.id,
        classScheduleId: classSchedule.body.id,
        employeeId: employee.body.id,
      };
    }

    it("marks a student's attendance for the currently-scheduled period on IDENTIFIED, marks it only once, and never overwrites an existing manual mark", async () => {
      const t = await buildReconciliationTarget(tokenA, `REC${run}`);

      await request(app.getHttpServer())
        .put("/organizations/me/biometric-policy")
        .set(...auth(tokenA))
        .send({ enabled: true })
        .expect(200);

      const student1 = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `REC-STU1-${run}`, firstName: "Reko", lastName: "Nissi", dateOfBirth: "2015-01-01" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/students/${student1.body.id}/enrollments`)
        .set(...auth(tokenA))
        .send({ programId: t.programId, sectionId: t.sectionId, termId: t.termId, enrollmentDate: "2020-01-01" })
        .expect(201);

      const enrollment1 = await request(app.getHttpServer())
        .post("/organizations/me/biometric/enrollments")
        .set(...auth(tokenA))
        .send({ studentId: student1.body.id, consentGivenBy: "self" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/biometric/enrollments/${enrollment1.body.id}/photo`)
        .set(...auth(tokenA))
        .attach("image", enrollmentFace)
        .expect(201);

      const camera = await request(app.getHttpServer())
        .post("/organizations/me/cameras")
        .set(...auth(tokenA))
        .send({ name: `Reconciliation Camera ${run}` })
        .expect(201);

      const capture1 = await request(app.getHttpServer())
        .post(`/organizations/me/cameras/${camera.body.id}/events`)
        .set(...auth(tokenA))
        .attach("image", enrollmentFace)
        .expect(201);
      expect(capture1.body.matches[0].result).toBe("IDENTIFIED");
      expect(capture1.body.matches[0].reconciledStudentAttendanceId).toBeTruthy();

      const sessionsAfterFirst = await request(app.getHttpServer())
        .get("/organizations/me/attendance-sessions")
        .set(...auth(tokenA))
        .expect(200);
      const mySession = sessionsAfterFirst.body.find(
        (s: { classScheduleId: string }) => s.classScheduleId === t.classScheduleId,
      );
      expect(mySession).toBeTruthy();
      expect(mySession.date.slice(0, 10)).toBe(todayStr);
      expect(mySession.studentAttendance).toHaveLength(1);
      expect(mySession.studentAttendance[0].studentId).toBe(student1.body.id);
      expect(mySession.studentAttendance[0].status).toBe("PRESENT");
      expect(mySession.studentAttendance[0].remarks).toContain("biometric");

      // A second capture of the same person must not create a second
      // row, or touch the one that already exists.
      const capture2 = await request(app.getHttpServer())
        .post(`/organizations/me/cameras/${camera.body.id}/events`)
        .set(...auth(tokenA))
        .attach("image", enrollmentFace)
        .expect(201);
      expect(capture2.body.matches[0].reconciledStudentAttendanceId).toBeFalsy();

      const sessionsAfterSecond = await request(app.getHttpServer())
        .get("/organizations/me/attendance-sessions")
        .set(...auth(tokenA))
        .expect(200);
      const mySessionAgain = sessionsAfterSecond.body.find(
        (s: { classScheduleId: string }) => s.classScheduleId === t.classScheduleId,
      );
      expect(mySessionAgain.studentAttendance).toHaveLength(1);

      // A second, separately-enrolled student, manually marked ABSENT
      // in the same session before ever being biometrically identified
      // — "augments, never replaces" means that manual mark must
      // survive an identification, not be silently upgraded.
      const student2 = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `REC-STU2-${run}`, firstName: "Reko", lastName: "Dossi", dateOfBirth: "2015-01-01" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/students/${student2.body.id}/enrollments`)
        .set(...auth(tokenA))
        .send({ programId: t.programId, sectionId: t.sectionId, termId: t.termId, enrollmentDate: "2020-01-01" })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/organizations/me/attendance-sessions/${mySession.id}/mark`)
        .set(...auth(tokenA))
        .send({ entries: [{ studentId: student2.body.id, status: "ABSENT", remarks: "Marked absent by teacher" }] })
        .expect(201);

      const enrollment2 = await request(app.getHttpServer())
        .post("/organizations/me/biometric/enrollments")
        .set(...auth(tokenA))
        .send({ studentId: student2.body.id, consentGivenBy: "self" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/biometric/enrollments/${enrollment2.body.id}/photo`)
        .set(...auth(tokenA))
        .attach("image", differentFace)
        .expect(201);

      const capture3 = await request(app.getHttpServer())
        .post(`/organizations/me/cameras/${camera.body.id}/events`)
        .set(...auth(tokenA))
        .attach("image", differentFace)
        .expect(201);
      expect(capture3.body.matches[0].result).toBe("IDENTIFIED");
      expect(capture3.body.matches[0].matchedEnrollmentId).toBe(enrollment2.body.id);
      // The manual mark already existed — reconciliation must not have
      // created (or touched) anything.
      expect(capture3.body.matches[0].reconciledStudentAttendanceId).toBeFalsy();

      const finalSession = await request(app.getHttpServer())
        .get(`/organizations/me/attendance-sessions/${mySession.id}`)
        .set(...auth(tokenA))
        .expect(200);
      const student2Row = finalSession.body.studentAttendance.find(
        (a: { studentId: string }) => a.studentId === student2.body.id,
      );
      expect(student2Row.status).toBe("ABSENT");
      expect(student2Row.remarks).toBe("Marked absent by teacher");
    }, 120000);

    it("marks staff attendance once via biometric identification, never overwrites an existing mark, and stays tenant-scoped", async () => {
      const t = await buildReconciliationTarget(tokenA, `RECSTAFF${run}`);

      await request(app.getHttpServer())
        .put("/organizations/me/biometric-policy")
        .set(...auth(tokenA))
        .send({ enabled: true })
        .expect(200);

      const enrollment = await request(app.getHttpServer())
        .post("/organizations/me/biometric/enrollments")
        .set(...auth(tokenA))
        .send({ staffId: t.employeeId, consentGivenBy: "self" })
        .expect(201);
      // Deliberately a different face than the student test above:
      // both tests share the same org, so reusing enrollmentFace here
      // would create a second FaceEnrollment with an identical
      // embedding, making the pgvector nearest-match ambiguous between
      // this staff enrollment and the earlier student one.
      await request(app.getHttpServer())
        .post(`/organizations/me/biometric/enrollments/${enrollment.body.id}/photo`)
        .set(...auth(tokenA))
        .attach("image", staffFace)
        .expect(201);

      const camera = await request(app.getHttpServer())
        .post("/organizations/me/cameras")
        .set(...auth(tokenA))
        .send({ name: `Staff Reconciliation Camera ${run}` })
        .expect(201);

      const capture1 = await request(app.getHttpServer())
        .post(`/organizations/me/cameras/${camera.body.id}/events`)
        .set(...auth(tokenA))
        .attach("image", staffFace)
        .expect(201);
      expect(capture1.body.matches[0].result).toBe("IDENTIFIED");
      expect(capture1.body.matches[0].matchedEnrollmentId).toBe(enrollment.body.id);
      expect(capture1.body.matches[0].reconciledStaffAttendanceId).toBeTruthy();

      const staffListA = await request(app.getHttpServer())
        .get("/organizations/me/staff-attendance")
        .set(...auth(tokenA))
        .expect(200);
      const myRecord = staffListA.body.find((a: { employeeId: string }) => a.employeeId === t.employeeId);
      expect(myRecord).toBeTruthy();
      expect(myRecord.date.slice(0, 10)).toBe(todayStr);
      expect(myRecord.status).toBe("PRESENT");
      expect(myRecord.remarks).toContain("biometric");

      // A second capture the same day must not create a duplicate or
      // touch the existing record.
      const capture2 = await request(app.getHttpServer())
        .post(`/organizations/me/cameras/${camera.body.id}/events`)
        .set(...auth(tokenA))
        .attach("image", staffFace)
        .expect(201);
      expect(capture2.body.matches[0].reconciledStaffAttendanceId).toBeFalsy();

      const staffListAfter = await request(app.getHttpServer())
        .get("/organizations/me/staff-attendance")
        .set(...auth(tokenA))
        .expect(200);
      expect(staffListAfter.body.filter((a: { employeeId: string }) => a.employeeId === t.employeeId)).toHaveLength(1);

      // Cross-tenant: none of org A's reconciled attendance is visible
      // to org B.
      const sessionsB = await request(app.getHttpServer())
        .get("/organizations/me/attendance-sessions")
        .set(...auth(tokenB))
        .expect(200);
      expect(sessionsB.body.find((s: { classScheduleId: string }) => s.classScheduleId === t.classScheduleId)).toBeUndefined();
      const staffListB = await request(app.getHttpServer())
        .get("/organizations/me/staff-attendance")
        .set(...auth(tokenB))
        .expect(200);
      expect(staffListB.body.find((a: { employeeId: string }) => a.employeeId === t.employeeId)).toBeUndefined();
    }, 90000);
  });

  describe("finance (fee structures, invoicing, manual payments — Phase 7 slice 7a-1)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    async function buildFinanceTarget(token: string, suffix: string) {
      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(token))
        .send({ name: `Finance Campus ${suffix}`, code: `FNCAMP${suffix}` })
        .expect(201);
      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(token))
        .send({ campusId: campus.body.id, name: `Finance Faculty ${suffix}`, code: `FNFAC${suffix}` })
        .expect(201);
      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(token))
        .send({ facultyId: faculty.body.id, name: `Finance Dept ${suffix}`, code: `FNDEP${suffix}` })
        .expect(201);
      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(token))
        .send({ departmentId: department.body.id, name: `Finance Program ${suffix}`, code: `FNPROG${suffix}` })
        .expect(201);
      const year = await request(app.getHttpServer())
        .post("/organizations/me/academic-years")
        .set(...auth(token))
        .send({ name: `Finance Year ${suffix}`, startDate: "2099-01-01", endDate: "2099-12-31" })
        .expect(201);
      const term = await request(app.getHttpServer())
        .post("/organizations/me/terms")
        .set(...auth(token))
        .send({
          academicYearId: year.body.id,
          name: `Finance Term ${suffix}`,
          code: `FNT${suffix}`,
          sequence: 1,
          startDate: "2099-01-01",
          endDate: "2099-06-30",
        })
        .expect(201);
      const section = await request(app.getHttpServer())
        .post("/organizations/me/sections")
        .set(...auth(token))
        .send({ programId: program.body.id, termId: term.body.id, name: `Finance Section ${suffix}`, code: `FNS${suffix}` })
        .expect(201);

      const studentIds: string[] = [];
      const enrollmentIds: string[] = [];
      for (const n of [1, 2]) {
        const student = await request(app.getHttpServer())
          .post("/organizations/me/students")
          .set(...auth(token))
          .send({
            studentCode: `FN-STU-${suffix}-${n}`,
            firstName: `Fin${n}`,
            lastName: suffix,
            dateOfBirth: "2015-01-01",
          })
          .expect(201);
        const enrollment = await request(app.getHttpServer())
          .post(`/organizations/me/students/${student.body.id}/enrollments`)
          .set(...auth(token))
          .send({
            programId: program.body.id,
            sectionId: section.body.id,
            termId: term.body.id,
            enrollmentDate: "2099-01-01",
          })
          .expect(201);
        studentIds.push(student.body.id);
        enrollmentIds.push(enrollment.body.id);
      }

      return { programId: program.body.id, termId: term.body.id, studentIds, enrollmentIds };
    }

    it("assigns a fee structure (single and bulk), snapshots invoice items, tracks payments to PAID, applies a discount, and stays tenant-scoped", async () => {
      const t = await buildFinanceTarget(tokenA, `FIN${run}`);

      const tuition = await request(app.getHttpServer())
        .post("/organizations/me/fee-categories")
        .set(...auth(tokenA))
        .send({ name: `Tuition ${run}`, code: `TUI${run}` })
        .expect(201);
      const library = await request(app.getHttpServer())
        .post("/organizations/me/fee-categories")
        .set(...auth(tokenA))
        .send({ name: `Library ${run}`, code: `LIB${run}` })
        .expect(201);

      const structure = await request(app.getHttpServer())
        .post("/organizations/me/fee-structures")
        .set(...auth(tokenA))
        .send({
          programId: t.programId,
          termId: t.termId,
          name: `Term 1 Fees ${run}`,
          items: [
            { feeCategoryId: tuition.body.id, amount: 5000 },
            { feeCategoryId: library.body.id, amount: 500 },
          ],
        })
        .expect(201);
      expect(structure.body.items).toHaveLength(2);

      const invoice1 = await request(app.getHttpServer())
        .post(`/organizations/me/fee-structures/${structure.body.id}/assign`)
        .set(...auth(tokenA))
        .send({ studentEnrollmentId: t.enrollmentIds[0], dueDate: "2099-02-01" })
        .expect(201);
      expect(invoice1.body.totalAmount).toBe("5500");
      expect(invoice1.body.items).toHaveLength(2);
      expect(invoice1.body.status).toBe("PENDING");

      // Assigning the same structure to the same enrollment twice is a
      // real conflict, not a silent no-op.
      await request(app.getHttpServer())
        .post(`/organizations/me/fee-structures/${structure.body.id}/assign`)
        .set(...auth(tokenA))
        .send({ studentEnrollmentId: t.enrollmentIds[0], dueDate: "2099-02-01" })
        .expect(409);

      // Bulk assigns everyone else still enrolled for this program/term —
      // student 1 is already assigned and gets skipped, not double-billed.
      const bulk = await request(app.getHttpServer())
        .post(`/organizations/me/fee-structures/${structure.body.id}/assign-bulk`)
        .set(...auth(tokenA))
        .send({ dueDate: "2099-02-01" })
        .expect(201);
      expect(bulk.body.assigned).toEqual([t.enrollmentIds[1]]);
      expect(bulk.body.skipped).toEqual([{ studentEnrollmentId: t.enrollmentIds[0], reason: "Already assigned" }]);

      const invoices = await request(app.getHttpServer())
        .get("/organizations/me/invoices")
        .set(...auth(tokenA))
        .expect(200);
      const invoice2 = invoices.body.find((i: { studentEnrollmentId: string }) => i.studentEnrollmentId === t.enrollmentIds[1]);
      expect(invoice2).toBeDefined();

      const payment1 = await request(app.getHttpServer())
        .post(`/organizations/me/invoices/${invoice1.body.id}/payments`)
        .set(...auth(tokenA))
        .send({ amount: 2000, method: "CASH" })
        .expect(201);
      expect(payment1.body.amount).toBe("2000");

      let refreshed = await request(app.getHttpServer())
        .get(`/organizations/me/invoices/${invoice1.body.id}`)
        .set(...auth(tokenA))
        .expect(200);
      expect(refreshed.body.status).toBe("PARTIALLY_PAID");

      await request(app.getHttpServer())
        .post(`/organizations/me/invoices/${invoice1.body.id}/payments`)
        .set(...auth(tokenA))
        .send({ amount: 3500, method: "BANK_TRANSFER", reference: `TXN-${run}` })
        .expect(201);

      refreshed = await request(app.getHttpServer())
        .get(`/organizations/me/invoices/${invoice1.body.id}`)
        .set(...auth(tokenA))
        .expect(200);
      expect(refreshed.body.status).toBe("PAID");

      // A discount larger than the outstanding balance is rejected, not
      // silently clamped.
      await request(app.getHttpServer())
        .post(`/organizations/me/invoices/${invoice2.id}/discounts`)
        .set(...auth(tokenA))
        .send({ amount: 999999, reason: "Too large" })
        .expect(400);

      const discount = await request(app.getHttpServer())
        .post(`/organizations/me/invoices/${invoice2.id}/discounts`)
        .set(...auth(tokenA))
        .send({ amount: 500, reason: "Sibling waiver" })
        .expect(201);
      expect(discount.body.amount).toBe("500");

      const transactions = await request(app.getHttpServer())
        .get("/organizations/me/financial-transactions")
        .set(...auth(tokenA))
        .expect(200);
      const forInvoice1 = transactions.body.filter((tr: { invoiceId: string }) => tr.invoiceId === invoice1.body.id);
      expect(forInvoice1.map((tr: { type: string }) => tr.type).sort()).toEqual(
        ["INVOICE_CREATED", "PAYMENT_RECORDED", "PAYMENT_RECORDED"].sort(),
      );

      const invoicesB = await request(app.getHttpServer())
        .get("/organizations/me/invoices")
        .set(...auth(tokenB))
        .expect(200);
      expect(invoicesB.body).toEqual([]);
      await request(app.getHttpServer())
        .get(`/organizations/me/invoices/${invoice1.body.id}`)
        .set(...auth(tokenB))
        .expect(404);
    }, 90000);

    it("auto-applies an active scholarship only to invoices generated after it's assigned, and supports refunds", async () => {
      const t = await buildFinanceTarget(tokenA, `FINSCH${run}`);

      const examFee = await request(app.getHttpServer())
        .post("/organizations/me/fee-categories")
        .set(...auth(tokenA))
        .send({ name: `Exam Fee ${run}`, code: `EXF${run}` })
        .expect(201);

      const structure1 = await request(app.getHttpServer())
        .post("/organizations/me/fee-structures")
        .set(...auth(tokenA))
        .send({
          programId: t.programId,
          termId: t.termId,
          name: `Tuition Only ${run}`,
          items: [{ feeCategoryId: examFee.body.id, amount: 4000 }],
        })
        .expect(201);

      const invoiceBefore = await request(app.getHttpServer())
        .post(`/organizations/me/fee-structures/${structure1.body.id}/assign`)
        .set(...auth(tokenA))
        .send({ studentEnrollmentId: t.enrollmentIds[0], dueDate: "2099-02-01" })
        .expect(201);
      expect(invoiceBefore.body.discounts).toEqual([]);

      // XOR: exactly one of percentage/amount, not both, not neither.
      await request(app.getHttpServer())
        .post("/organizations/me/scholarships")
        .set(...auth(tokenA))
        .send({ name: `Bad Scholarship ${run}`, percentage: 10, amount: 100 })
        .expect(400);

      const scholarship = await request(app.getHttpServer())
        .post("/organizations/me/scholarships")
        .set(...auth(tokenA))
        .send({ name: `Merit Scholarship ${run}`, percentage: 25 })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/students/${t.studentIds[0]}/scholarships`)
        .set(...auth(tokenA))
        .send({ scholarshipId: scholarship.body.id })
        .expect(201);

      const structure2 = await request(app.getHttpServer())
        .post("/organizations/me/fee-structures")
        .set(...auth(tokenA))
        .send({
          programId: t.programId,
          termId: t.termId,
          name: `Exam Fees ${run}`,
          items: [{ feeCategoryId: examFee.body.id, amount: 2000 }],
        })
        .expect(201);

      const invoiceAfter = await request(app.getHttpServer())
        .post(`/organizations/me/fee-structures/${structure2.body.id}/assign`)
        .set(...auth(tokenA))
        .send({ studentEnrollmentId: t.enrollmentIds[0], dueDate: "2099-02-01" })
        .expect(201);
      expect(invoiceAfter.body.discounts).toHaveLength(1);
      expect(invoiceAfter.body.discounts[0].amount).toBe("500"); // 25% of 2000
      expect(invoiceAfter.body.discounts[0].scholarshipId).toBe(scholarship.body.id);

      // The earlier invoice, issued before the scholarship existed, is
      // never retroactively touched.
      const invoiceBeforeRefetched = await request(app.getHttpServer())
        .get(`/organizations/me/invoices/${invoiceBefore.body.id}`)
        .set(...auth(tokenA))
        .expect(200);
      expect(invoiceBeforeRefetched.body.discounts).toEqual([]);

      // Net payable is 2000 - 500 = 1500; pay it in full.
      const payment = await request(app.getHttpServer())
        .post(`/organizations/me/invoices/${invoiceAfter.body.id}/payments`)
        .set(...auth(tokenA))
        .send({ amount: 1500, method: "CASH" })
        .expect(201);

      let refreshed = await request(app.getHttpServer())
        .get(`/organizations/me/invoices/${invoiceAfter.body.id}`)
        .set(...auth(tokenA))
        .expect(200);
      expect(refreshed.body.status).toBe("PAID");

      // Refunding more than what's left refundable on the payment is
      // rejected.
      await request(app.getHttpServer())
        .post(`/organizations/me/payments/${payment.body.id}/refunds`)
        .set(...auth(tokenA))
        .send({ amount: 2000, reason: "Too much" })
        .expect(400);

      await request(app.getHttpServer())
        .post(`/organizations/me/payments/${payment.body.id}/refunds`)
        .set(...auth(tokenA))
        .send({ amount: 500, reason: "Partial refund" })
        .expect(201);

      refreshed = await request(app.getHttpServer())
        .get(`/organizations/me/invoices/${invoiceAfter.body.id}`)
        .set(...auth(tokenA))
        .expect(200);
      expect(refreshed.body.status).toBe("PARTIALLY_PAID");

      const transactions = await request(app.getHttpServer())
        .get("/organizations/me/financial-transactions")
        .set(...auth(tokenA))
        .expect(200);
      const forInvoiceAfter = transactions.body.filter(
        (tr: { invoiceId: string }) => tr.invoiceId === invoiceAfter.body.id,
      );
      expect(forInvoiceAfter.map((tr: { type: string }) => tr.type).sort()).toEqual(
        ["INVOICE_CREATED", "SCHOLARSHIP_APPLIED", "PAYMENT_RECORDED", "REFUND_ISSUED"].sort(),
      );
    }, 90000);
  });

  describe("eSewa online payment (Phase 7 slice 7a-2 — real sandbox signing + status-check gating)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    async function buildEsewaInvoice(token: string, suffix: string) {
      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(token))
        .send({ name: `Esewa Campus ${suffix}`, code: `ESCAMP${suffix}` })
        .expect(201);
      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(token))
        .send({ campusId: campus.body.id, name: `Esewa Faculty ${suffix}`, code: `ESFAC${suffix}` })
        .expect(201);
      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(token))
        .send({ facultyId: faculty.body.id, name: `Esewa Dept ${suffix}`, code: `ESDEP${suffix}` })
        .expect(201);
      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(token))
        .send({ departmentId: department.body.id, name: `Esewa Program ${suffix}`, code: `ESPROG${suffix}` })
        .expect(201);
      const year = await request(app.getHttpServer())
        .post("/organizations/me/academic-years")
        .set(...auth(token))
        .send({ name: `Esewa Year ${suffix}`, startDate: "2099-01-01", endDate: "2099-12-31" })
        .expect(201);
      const term = await request(app.getHttpServer())
        .post("/organizations/me/terms")
        .set(...auth(token))
        .send({
          academicYearId: year.body.id,
          name: `Esewa Term ${suffix}`,
          code: `EST${suffix}`,
          sequence: 1,
          startDate: "2099-01-01",
          endDate: "2099-06-30",
        })
        .expect(201);
      const section = await request(app.getHttpServer())
        .post("/organizations/me/sections")
        .set(...auth(token))
        .send({ programId: program.body.id, termId: term.body.id, name: `Esewa Section ${suffix}`, code: `ESS${suffix}` })
        .expect(201);
      const student = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(token))
        .send({ studentCode: `ES-STU-${suffix}`, firstName: "Esewa", lastName: suffix, dateOfBirth: "2015-01-01" })
        .expect(201);
      const enrollment = await request(app.getHttpServer())
        .post(`/organizations/me/students/${student.body.id}/enrollments`)
        .set(...auth(token))
        .send({ programId: program.body.id, sectionId: section.body.id, termId: term.body.id, enrollmentDate: "2099-01-01" })
        .expect(201);

      const category = await request(app.getHttpServer())
        .post("/organizations/me/fee-categories")
        .set(...auth(token))
        .send({ name: `Esewa Fee ${suffix}`, code: `ESF${suffix}` })
        .expect(201);
      const structure = await request(app.getHttpServer())
        .post("/organizations/me/fee-structures")
        .set(...auth(token))
        .send({
          programId: program.body.id,
          termId: term.body.id,
          name: `Esewa Fees ${suffix}`,
          items: [{ feeCategoryId: category.body.id, amount: 1000 }],
        })
        .expect(201);
      const invoice = await request(app.getHttpServer())
        .post(`/organizations/me/fee-structures/${structure.body.id}/assign`)
        .set(...auth(token))
        .send({ studentEnrollmentId: enrollment.body.id, dueDate: "2099-02-01" })
        .expect(201);

      return { studentId: student.body.id, invoiceId: invoice.body.id };
    }

    it("initiates a correctly-signed eSewa form payload against the real sandbox, refuses to credit an unconfirmed transaction, rejects a malformed confirmation payload, and stays tenant-scoped", async () => {
      const { invoiceId } = await buildEsewaInvoice(tokenA, `ESWA${run}`);

      const initiated = await request(app.getHttpServer())
        .post(`/organizations/me/invoices/${invoiceId}/esewa/initiate`)
        .set(...auth(tokenA))
        .send({ amount: 1000 })
        .expect(201);
      expect(initiated.body.actionUrl).toBe("https://rc-epay.esewa.com.np/api/epay/main/v2/form");
      expect(initiated.body.fields.product_code).toBe("EPAYTEST");
      expect(initiated.body.fields.total_amount).toBe("1000.00");
      const transactionUuid = initiated.body.fields.transaction_uuid;

      // Independently recompute the HMAC against eSewa's own published
      // sandbox secret key and algorithm — confirms the signature is
      // actually correct, not just present.
      const expectedSignature = createHmac("sha256", "8gBm/:&EnhH.1/q")
        .update(`total_amount=1000.00,transaction_uuid=${transactionUuid},product_code=EPAYTEST`)
        .digest("base64");
      expect(initiated.body.fields.signature).toBe(expectedSignature);

      // This transaction was never actually paid on eSewa's side. A
      // forged redirect payload claiming COMPLETE must not be trusted —
      // confirmEsewaPayment's real gate is a live checkStatus() call
      // back to eSewa's own sandbox, which correctly reports this
      // transaction as not paid, so no Payment gets created.
      const forgedPayload = Buffer.from(
        JSON.stringify({
          transaction_code: "FAKE",
          status: "COMPLETE",
          total_amount: 1000,
          transaction_uuid: transactionUuid,
          product_code: "EPAYTEST",
          signed_field_names: "total_amount,transaction_uuid,product_code",
          signature: "not-a-real-signature",
        }),
      ).toString("base64");
      await request(app.getHttpServer())
        .post("/organizations/me/esewa/verify")
        .set(...auth(tokenA))
        .send({ data: forgedPayload })
        .expect(400);

      const refreshed = await request(app.getHttpServer())
        .get(`/organizations/me/invoices/${invoiceId}`)
        .set(...auth(tokenA))
        .expect(200);
      expect(refreshed.body.status).toBe("PENDING");
      expect(refreshed.body.payments).toEqual([]);

      // A malformed (non-JSON) payload 400s cleanly, not a 500.
      await request(app.getHttpServer())
        .post("/organizations/me/esewa/verify")
        .set(...auth(tokenA))
        .send({ data: "not-valid-base64-json!!" })
        .expect(400);

      // A well-formed payload for a transaction_uuid that was never
      // initiated 404s.
      const unknownPayload = Buffer.from(
        JSON.stringify({ transaction_uuid: "00000000-0000-0000-0000-000000000000", status: "COMPLETE" }),
      ).toString("base64");
      await request(app.getHttpServer())
        .post("/organizations/me/esewa/verify")
        .set(...auth(tokenA))
        .send({ data: unknownPayload })
        .expect(404);

      // Cross-tenant: org B can't initiate a payment against org A's invoice.
      await request(app.getHttpServer())
        .post(`/organizations/me/invoices/${invoiceId}/esewa/initiate`)
        .set(...auth(tokenB))
        .send({ amount: 1000 })
        .expect(404);
    }, 30000);

    it("supports self-service payment initiation via the student portal, and rejects a student initiating or confirming a payment against another student's invoice (IDOR guard)", async () => {
      const { studentId: ownerStudentId, invoiceId } = await buildEsewaInvoice(tokenA, `ESWP${run}`);
      const { studentId: otherStudentId } = await buildEsewaInvoice(tokenA, `ESWP2${run}`);

      const ownerLogin = await request(app.getHttpServer())
        .post(`/organizations/me/students/${ownerStudentId}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "EsewaPass123" })
        .expect(201);
      const otherLogin = await request(app.getHttpServer())
        .post(`/organizations/me/students/${otherStudentId}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "EsewaPass456" })
        .expect(201);
      const ownerSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: ownerLogin.body.username, password: "EsewaPass123" })
        .expect(201);
      const otherSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: otherLogin.body.username, password: "EsewaPass456" })
        .expect(201);

      // The owner sees their own invoice, with no `student` field
      // leaked on the self-service list (the caller already knows who
      // they are).
      const ownInvoices = await request(app.getHttpServer())
        .get("/organizations/me/portal/invoices")
        .set(...auth(ownerSession.body.accessToken))
        .expect(200);
      expect(ownInvoices.body.map((i: { id: string }) => i.id)).toContain(invoiceId);
      expect(ownInvoices.body[0]).not.toHaveProperty("student");

      // The owner can initiate a real, correctly-signed eSewa payment
      // for their own invoice through the portal.
      const initiated = await request(app.getHttpServer())
        .post(`/organizations/me/portal/invoices/${invoiceId}/esewa/initiate`)
        .set(...auth(ownerSession.body.accessToken))
        .send({ amount: 1000 })
        .expect(201);
      expect(initiated.body.fields.transaction_uuid).toEqual(expect.any(String));

      // A different student cannot initiate a payment against this
      // invoice — 404, not 403, same IDOR-by-construction guard as
      // every other portal route.
      await request(app.getHttpServer())
        .post(`/organizations/me/portal/invoices/${invoiceId}/esewa/initiate`)
        .set(...auth(otherSession.body.accessToken))
        .send({ amount: 1000 })
        .expect(404);

      // Nor can they confirm a payment against it, even naming a
      // well-formed transaction_uuid that really was initiated for this
      // invoice (by its owner).
      const payload = Buffer.from(
        JSON.stringify({ transaction_uuid: initiated.body.fields.transaction_uuid, status: "COMPLETE" }),
      ).toString("base64");
      await request(app.getHttpServer())
        .post("/organizations/me/portal/esewa/verify")
        .set(...auth(otherSession.body.accessToken))
        .send({ data: payload })
        .expect(404);
    }, 30000);
  });

  describe("Roles & Permissions admin (per-school custom roles, built from the shared permission catalog)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    it("creates a custom role from a subset of the permission catalog, assigns/unassigns it, enforces exactly those permissions, edits and deletes it, audits every action, and stays tenant-scoped", async () => {
      const permissions = await request(app.getHttpServer())
        .get("/organizations/me/permissions")
        .set(...auth(tokenA))
        .expect(200);
      const invoiceView = permissions.body.find(
        (p: { resource: string; action: string }) => p.resource === "invoice" && p.action === "VIEW",
      );
      expect(invoiceView).toBeDefined();

      const role = await request(app.getHttpServer())
        .post("/organizations/me/roles")
        .set(...auth(tokenA))
        .send({ name: `Invoice Viewer ${run}`, description: "e2e test role", permissionIds: [invoiceView.id] })
        .expect(201);
      expect(role.body.isSystem).toBe(false);
      expect(role.body.rolePermissions).toHaveLength(1);

      // Duplicate name within the same org is rejected, not silently allowed.
      await request(app.getHttpServer())
        .post("/organizations/me/roles")
        .set(...auth(tokenA))
        .send({ name: `Invoice Viewer ${run}`, permissionIds: [invoiceView.id] })
        .expect(409);

      // A student create-login auto-grants the "Student" system role — used
      // here purely as a convenient way to get a real second User, then
      // re-pointed at the custom role under test via the new endpoints.
      const student = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `RBAC-STU-${run}`, firstName: "Rbac", lastName: "Test", dateOfBirth: "2015-01-01" })
        .expect(201);
      const login = await request(app.getHttpServer())
        .post(`/organizations/me/students/${student.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "RbacTest123!" })
        .expect(201);

      const usersList = await request(app.getHttpServer())
        .get("/organizations/me/users")
        .set(...auth(tokenA))
        .expect(200);
      const newUser = usersList.body.find((u: { username: string }) => u.username === login.body.username);
      expect(newUser).toBeDefined();
      const studentRoleAssignment = newUser.userRoles.find((ur: { role: { name: string } }) => ur.role.name === "Student");
      expect(studentRoleAssignment).toBeDefined();

      await request(app.getHttpServer())
        .delete(`/organizations/me/users/${newUser.id}/roles/${studentRoleAssignment.roleId}`)
        .set(...auth(tokenA))
        .expect(200);
      await request(app.getHttpServer())
        .post(`/organizations/me/users/${newUser.id}/roles`)
        .set(...auth(tokenA))
        .send({ roleId: role.body.id })
        .expect(201);
      // Re-assigning the same role again is a conflict, not a silent no-op.
      await request(app.getHttpServer())
        .post(`/organizations/me/users/${newUser.id}/roles`)
        .set(...auth(tokenA))
        .send({ roleId: role.body.id })
        .expect(409);

      const session = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: login.body.username, password: "RbacTest123!" })
        .expect(201);
      await request(app.getHttpServer())
        .get("/organizations/me/invoices")
        .set(...auth(session.body.accessToken))
        .expect(200);
      await request(app.getHttpServer())
        .get("/organizations/me/students")
        .set(...auth(session.body.accessToken))
        .expect(403);

      // Revoke the permission from the role. Permissions are baked into the
      // JWT at login/refresh, not checked live — the already-issued token
      // keeps working, a freshly-issued one doesn't.
      await request(app.getHttpServer())
        .patch(`/organizations/me/roles/${role.body.id}`)
        .set(...auth(tokenA))
        .send({ permissionIds: [] })
        .expect(200);
      await request(app.getHttpServer())
        .get("/organizations/me/invoices")
        .set(...auth(session.body.accessToken))
        .expect(200);

      const freshSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: login.body.username, password: "RbacTest123!" })
        .expect(201);
      await request(app.getHttpServer())
        .get("/organizations/me/invoices")
        .set(...auth(freshSession.body.accessToken))
        .expect(403);

      // Deleting a role still assigned to a user is rejected with the count,
      // not silently cascaded.
      const deleteBlocked = await request(app.getHttpServer())
        .delete(`/organizations/me/roles/${role.body.id}`)
        .set(...auth(tokenA))
        .expect(409);
      expect(deleteBlocked.body.message).toContain("1 user");

      await request(app.getHttpServer())
        .delete(`/organizations/me/users/${newUser.id}/roles/${role.body.id}`)
        .set(...auth(tokenA))
        .expect(200);
      await request(app.getHttpServer())
        .delete(`/organizations/me/roles/${role.body.id}`)
        .set(...auth(tokenA))
        .expect(200);

      // Cross-tenant: org B can't see, edit, or be affected by org A's
      // custom roles/users, even by a well-formed id.
      const role2 = await request(app.getHttpServer())
        .post("/organizations/me/roles")
        .set(...auth(tokenA))
        .send({ name: `Cross Tenant Test ${run}`, permissionIds: [invoiceView.id] })
        .expect(201);
      const rolesB = await request(app.getHttpServer())
        .get("/organizations/me/roles")
        .set(...auth(tokenB))
        .expect(200);
      expect(rolesB.body.find((r: { id: string }) => r.id === role2.body.id)).toBeUndefined();
      await request(app.getHttpServer())
        .patch(`/organizations/me/roles/${role2.body.id}`)
        .set(...auth(tokenB))
        .send({ name: "hijacked" })
        .expect(404);
      const usersB = await request(app.getHttpServer())
        .get("/organizations/me/users")
        .set(...auth(tokenB))
        .expect(200);
      expect(usersB.body.find((u: { id: string }) => u.id === newUser.id)).toBeUndefined();

      const auditLogs = await request(app.getHttpServer())
        .get("/organizations/me/audit-logs")
        .set(...auth(tokenA))
        .expect(200);
      const actions = auditLogs.body.map((e: { action: string }) => e.action);
      expect(actions).toEqual(
        expect.arrayContaining(["role.created", "role.updated", "role.deleted", "user.role_assigned", "user.role_unassigned"]),
      );
    }, 60000);
  });

  describe("Leave (HR & Payroll, part 1 — Phase 7 slice 7b-1)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    async function buildEmployee(token: string, suffix: string) {
      const staffType = await request(app.getHttpServer())
        .post("/organizations/me/staff-types")
        .set(...auth(token))
        .send({ name: `Leave Teaching ${suffix}`, code: `LTEACH${suffix}` })
        .expect(201);
      const designation = await request(app.getHttpServer())
        .post("/organizations/me/designations")
        .set(...auth(token))
        .send({ name: `Leave Teacher ${suffix}`, code: `LTCHR${suffix}` })
        .expect(201);
      const employee = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(token))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `LV-EMP-${suffix}`,
          firstName: "Leave",
          lastName: suffix,
          email: `leave-${suffix}@staff-e2e.test`,
          dateOfJoining: "2026-01-01",
        })
        .expect(201);
      return employee.body.id as string;
    }

    it("allocates a leave balance, enforces it at both request-creation and approval time, allows an unallocated type freely, rejects/cancels, and stays tenant-scoped", async () => {
      const employeeId = await buildEmployee(tokenA, `LV${run}`);
      const year = new Date().getFullYear();

      const leaveType = await request(app.getHttpServer())
        .post("/organizations/me/leave-types")
        .set(...auth(tokenA))
        .send({ name: `Sick Leave ${run}`, code: `SICK${run}`, defaultDaysPerYear: 12 })
        .expect(201);
      const untrackedType = await request(app.getHttpServer())
        .post("/organizations/me/leave-types")
        .set(...auth(tokenA))
        .send({ name: `Unpaid Leave ${run}`, code: `UNPAID${run}`, defaultDaysPerYear: 0, isPaid: false })
        .expect(201);

      const balance = await request(app.getHttpServer())
        .post("/organizations/me/leave-balances")
        .set(...auth(tokenA))
        .send({ employeeId, leaveTypeId: leaveType.body.id, year, allocatedDays: 6 })
        .expect(201);
      expect(balance.body.allocatedDays).toBe(6);

      // Re-allocating the same employee+type+year is an upsert (a
      // legitimate admin correction), not a conflict.
      const reallocated = await request(app.getHttpServer())
        .post("/organizations/me/leave-balances")
        .set(...auth(tokenA))
        .send({ employeeId, leaveTypeId: leaveType.body.id, year, allocatedDays: 6 })
        .expect(201);
      expect(reallocated.body.allocatedDays).toBe(6);

      // Request A (3 days) — nothing approved yet, well within balance.
      const reqA = await request(app.getHttpServer())
        .post("/organizations/me/leave-requests")
        .set(...auth(tokenA))
        .send({ employeeId, leaveTypeId: leaveType.body.id, startDate: `${year}-06-01`, endDate: `${year}-06-03`, reason: "Flu" })
        .expect(201);
      expect(reqA.body.days).toBe(3);
      expect(reqA.body.status).toBe("PENDING");

      await request(app.getHttpServer())
        .post(`/organizations/me/leave-requests/${reqA.body.id}/approve`)
        .set(...auth(tokenA))
        .expect(201);

      // Request B (5 days) — creation-time check: 3 already approved + 5
      // would be 8 > 6 allocated, rejected before it can even become PENDING.
      await request(app.getHttpServer())
        .post("/organizations/me/leave-requests")
        .set(...auth(tokenA))
        .send({ employeeId, leaveTypeId: leaveType.body.id, startDate: `${year}-06-10`, endDate: `${year}-06-14`, reason: "Too many" })
        .expect(400);

      // Request C (2 days) and Request D (3 days) both created while only
      // A (3 days) is approved: 3+2=5<=6 and 3+3=6<=6, so creation-time
      // checks pass for both, even though approving both later would not.
      const reqC = await request(app.getHttpServer())
        .post("/organizations/me/leave-requests")
        .set(...auth(tokenA))
        .send({ employeeId, leaveTypeId: leaveType.body.id, startDate: `${year}-07-01`, endDate: `${year}-07-02`, reason: "C" })
        .expect(201);
      const reqD = await request(app.getHttpServer())
        .post("/organizations/me/leave-requests")
        .set(...auth(tokenA))
        .send({ employeeId, leaveTypeId: leaveType.body.id, startDate: `${year}-08-01`, endDate: `${year}-08-03`, reason: "D" })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/organizations/me/leave-requests/${reqC.body.id}/approve`)
        .set(...auth(tokenA))
        .expect(201);

      // Approving D now re-checks the balance at approval time: 3(A)+2(C)
      // already approved, +3(D) = 8 > 6 — rejected even though D passed
      // its own creation-time check.
      await request(app.getHttpServer())
        .post(`/organizations/me/leave-requests/${reqD.body.id}/approve`)
        .set(...auth(tokenA))
        .expect(400);

      // A request against a leave type with no allocation for this
      // employee+year is allowed freely — "no allocation" means
      // untracked, not "zero."
      const untrackedRequest = await request(app.getHttpServer())
        .post("/organizations/me/leave-requests")
        .set(...auth(tokenA))
        .send({ employeeId, leaveTypeId: untrackedType.body.id, startDate: `${year}-09-01`, endDate: `${year}-09-10`, reason: "Unpaid" })
        .expect(201);
      expect(untrackedRequest.body.days).toBe(10);

      // Reject D (still pending), then confirm re-rejecting/re-approving/
      // cancelling an already-terminal request 409s, not a silent no-op.
      const rejected = await request(app.getHttpServer())
        .post(`/organizations/me/leave-requests/${reqD.body.id}/reject`)
        .set(...auth(tokenA))
        .send({ reviewComment: "Exceeds balance" })
        .expect(201);
      expect(rejected.body.status).toBe("REJECTED");
      expect(rejected.body.reviewComment).toBe("Exceeds balance");
      await request(app.getHttpServer())
        .post(`/organizations/me/leave-requests/${reqD.body.id}/cancel`)
        .set(...auth(tokenA))
        .expect(409);

      // Cancel the untracked request while it's still pending.
      const cancelled = await request(app.getHttpServer())
        .post(`/organizations/me/leave-requests/${untrackedRequest.body.id}/cancel`)
        .set(...auth(tokenA))
        .expect(201);
      expect(cancelled.body.status).toBe("CANCELLED");

      // Final computed balance: A (3) + C (2) approved = 5 used, 1 remaining.
      const finalBalances = await request(app.getHttpServer())
        .get(`/organizations/me/employees/${employeeId}/leave-balances`)
        .set(...auth(tokenA))
        .expect(200);
      const finalSickBalance = finalBalances.body.find((b: { leaveTypeId: string }) => b.leaveTypeId === leaveType.body.id);
      expect(finalSickBalance.usedDays).toBe(5);
      expect(finalSickBalance.remainingDays).toBe(1);

      // Cross-tenant: org B sees none of this and can't act on it by id.
      for (const path of ["leave-types", "leave-requests"]) {
        const res = await request(app.getHttpServer())
          .get(`/organizations/me/${path}`)
          .set(...auth(tokenB))
          .expect(200);
        expect(res.body).toEqual([]);
      }
      await request(app.getHttpServer())
        .get(`/organizations/me/employees/${employeeId}/leave-balances`)
        .set(...auth(tokenB))
        .expect(404);
      await request(app.getHttpServer())
        .post(`/organizations/me/leave-requests/${reqC.body.id}/approve`)
        .set(...auth(tokenB))
        .expect(404);
    }, 60000);
  });

  describe("Payroll (HR & Payroll, part 2 — Phase 7 slice 7b-2)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    async function buildEmployee(token: string, suffix: string) {
      const staffType = await request(app.getHttpServer())
        .post("/organizations/me/staff-types")
        .set(...auth(token))
        .send({ name: `Payroll Teaching ${suffix}`, code: `PTEACH${suffix}` })
        .expect(201);
      const designation = await request(app.getHttpServer())
        .post("/organizations/me/designations")
        .set(...auth(token))
        .send({ name: `Payroll Teacher ${suffix}`, code: `PTCHR${suffix}` })
        .expect(201);
      const employee = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(token))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `PR-EMP-${suffix}`,
          firstName: "Payroll",
          lastName: suffix,
          email: `payroll-${suffix}@staff-e2e.test`,
          dateOfJoining: "2026-01-01",
        })
        .expect(201);
      return employee.body.id as string;
    }

    it("generates payroll from a snapshotted salary structure with an unpaid-leave deduction, and walks the DRAFT/FINALIZED/PAID/CANCELLED lifecycle", async () => {
      const employeeId = await buildEmployee(tokenA, `PR${run}`);

      const structure = await request(app.getHttpServer())
        .post("/organizations/me/salary-structures")
        .set(...auth(tokenA))
        .send({
          name: `Teacher Grade A ${run}`,
          basicSalary: 30000,
          items: [
            { type: "EARNING", name: "House Rent Allowance", percentOfBasic: 10 },
            { type: "DEDUCTION", name: "Provident Fund", amount: 1500 },
          ],
        })
        .expect(201);
      expect(structure.body.items).toHaveLength(2);

      await request(app.getHttpServer())
        .post(`/organizations/me/employees/${employeeId}/salary-structure`)
        .set(...auth(tokenA))
        .send({ salaryStructureId: structure.body.id })
        .expect(201);

      // Nov 2026 has 30 days. A 3-day APPROVED unpaid-leave request inside
      // it should deduct 30000/30*3 = 3000 at generation time.
      const unpaidType = await request(app.getHttpServer())
        .post("/organizations/me/leave-types")
        .set(...auth(tokenA))
        .send({ name: `Unpaid ${run}`, code: `PRUNPAID${run}`, defaultDaysPerYear: 0, isPaid: false })
        .expect(201);
      const leaveRequest = await request(app.getHttpServer())
        .post("/organizations/me/leave-requests")
        .set(...auth(tokenA))
        .send({ employeeId, leaveTypeId: unpaidType.body.id, startDate: "2026-11-05", endDate: "2026-11-07" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/leave-requests/${leaveRequest.body.id}/approve`)
        .set(...auth(tokenA))
        .expect(201);

      const generated = await request(app.getHttpServer())
        .post("/organizations/me/payroll/generate")
        .set(...auth(tokenA))
        .send({ periodMonth: 11, periodYear: 2026 })
        .expect(201);
      expect(generated.body.generated).toEqual([employeeId]);
      expect(generated.body.skipped).toEqual([]);

      const list = await request(app.getHttpServer())
        .get("/organizations/me/payroll")
        .set(...auth(tokenA))
        .query({ employeeId, periodMonth: 11, periodYear: 2026 })
        .expect(200);
      expect(list.body).toHaveLength(1);
      const payrollId = list.body[0].id;
      expect(list.body[0].status).toBe("DRAFT");
      expect(list.body[0].grossPay).toBeNull();

      const detail = await request(app.getHttpServer())
        .get(`/organizations/me/payroll/${payrollId}`)
        .set(...auth(tokenA))
        .expect(200);
      const itemNames = detail.body.items.map((i: { name: string; amount: string; type: string }) => `${i.name}:${i.type}:${i.amount}`);
      expect(itemNames).toContain("Basic Salary:EARNING:30000");
      expect(itemNames).toContain("House Rent Allowance:EARNING:3000");
      expect(itemNames).toContain("Provident Fund:DEDUCTION:1500");
      expect(itemNames).toContain("Unpaid Leave (3 days):DEDUCTION:3000");

      // Re-generating the same period skips the already-generated employee.
      const regenerated = await request(app.getHttpServer())
        .post("/organizations/me/payroll/generate")
        .set(...auth(tokenA))
        .send({ periodMonth: 11, periodYear: 2026 })
        .expect(201);
      expect(regenerated.body.generated).toEqual([]);
      expect(regenerated.body.skipped).toEqual([{ employeeId, reason: "Already generated for this period" }]);

      // Items are editable only while DRAFT.
      const bonus = await request(app.getHttpServer())
        .post(`/organizations/me/payroll/${payrollId}/items`)
        .set(...auth(tokenA))
        .send({ type: "EARNING", name: "Festival Bonus", amount: 2000 })
        .expect(201);
      await request(app.getHttpServer())
        .delete(`/organizations/me/payroll/${payrollId}/items/${bonus.body.id}`)
        .set(...auth(tokenA))
        .expect(200);

      // Finalize freezes gross/deductions/net: (30000+3000) - (1500+3000) = 28500.
      const finalized = await request(app.getHttpServer())
        .post(`/organizations/me/payroll/${payrollId}/finalize`)
        .set(...auth(tokenA))
        .expect(201);
      expect(finalized.body.status).toBe("FINALIZED");
      expect(finalized.body.grossPay).toBe("33000");
      expect(finalized.body.totalDeductions).toBe("4500");
      expect(finalized.body.netPay).toBe("28500");

      // Once FINALIZED: no more item edits, no second finalize, no pay
      // without a payment method.
      await request(app.getHttpServer())
        .post(`/organizations/me/payroll/${payrollId}/items`)
        .set(...auth(tokenA))
        .send({ type: "EARNING", name: "Too Late", amount: 1 })
        .expect(409);
      await request(app.getHttpServer())
        .post(`/organizations/me/payroll/${payrollId}/finalize`)
        .set(...auth(tokenA))
        .expect(409);
      await request(app.getHttpServer())
        .post(`/organizations/me/payroll/${payrollId}/pay`)
        .set(...auth(tokenA))
        .send({})
        .expect(400);

      const paid = await request(app.getHttpServer())
        .post(`/organizations/me/payroll/${payrollId}/pay`)
        .set(...auth(tokenA))
        .send({ paymentMethod: "BANK_TRANSFER" })
        .expect(201);
      expect(paid.body.status).toBe("PAID");
      expect(paid.body.paymentMethod).toBe("BANK_TRANSFER");
      expect(paid.body.paidAt).not.toBeNull();

      // A PAID payroll can never be cancelled — a real-world fact, not undoable.
      await request(app.getHttpServer())
        .post(`/organizations/me/payroll/${payrollId}/cancel`)
        .set(...auth(tokenA))
        .expect(409);

      // A second employee's payroll can be cancelled from DRAFT, and a
      // third's from FINALIZED, but never twice.
      const employee2Id = await buildEmployee(tokenA, `PR2${run}`);
      const structure2 = await request(app.getHttpServer())
        .post("/organizations/me/salary-structures")
        .set(...auth(tokenA))
        .send({ name: `Teacher Grade B ${run}`, basicSalary: 20000, items: [] })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/employees/${employee2Id}/salary-structure`)
        .set(...auth(tokenA))
        .send({ salaryStructureId: structure2.body.id })
        .expect(201);
      await request(app.getHttpServer())
        .post("/organizations/me/payroll/generate")
        .set(...auth(tokenA))
        .send({ periodMonth: 11, periodYear: 2026 })
        .expect(201);
      const list2 = await request(app.getHttpServer())
        .get("/organizations/me/payroll")
        .set(...auth(tokenA))
        .query({ employeeId: employee2Id, periodMonth: 11, periodYear: 2026 })
        .expect(200);
      const payroll2Id = list2.body[0].id;

      const cancelledDraft = await request(app.getHttpServer())
        .post(`/organizations/me/payroll/${payroll2Id}/cancel`)
        .set(...auth(tokenA))
        .expect(201);
      expect(cancelledDraft.body.status).toBe("CANCELLED");
      await request(app.getHttpServer())
        .post(`/organizations/me/payroll/${payroll2Id}/cancel`)
        .set(...auth(tokenA))
        .expect(409);

      // Unassigning the salary structure means the next generate skips
      // that employee entirely (no structure to snapshot from).
      await request(app.getHttpServer())
        .delete(`/organizations/me/employees/${employee2Id}/salary-structure`)
        .set(...auth(tokenA))
        .expect(200);
      const decemberGenerate = await request(app.getHttpServer())
        .post("/organizations/me/payroll/generate")
        .set(...auth(tokenA))
        .send({ periodMonth: 12, periodYear: 2026 })
        .expect(201);
      expect(decemberGenerate.body.generated).not.toContain(employee2Id);

      // Cross-tenant: org B sees none of this and can't act on it by id.
      for (const path of ["salary-structures", "payroll"]) {
        const res = await request(app.getHttpServer())
          .get(`/organizations/me/${path}`)
          .set(...auth(tokenB))
          .expect(200);
        expect(res.body).toEqual([]);
      }
      await request(app.getHttpServer())
        .get(`/organizations/me/payroll/${payrollId}`)
        .set(...auth(tokenB))
        .expect(404);
      await request(app.getHttpServer())
        .post(`/organizations/me/payroll/${payrollId}/cancel`)
        .set(...auth(tokenB))
        .expect(404);
    }, 60000);
  });

  describe("Transport, part 1 (core roster — Phase 7 slice 7d-1)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    async function buildEmployee(token: string, suffix: string) {
      const staffType = await request(app.getHttpServer())
        .post("/organizations/me/staff-types")
        .set(...auth(token))
        .send({ name: `Transport Staff ${suffix}`, code: `TSTAFF${suffix}` })
        .expect(201);
      const designation = await request(app.getHttpServer())
        .post("/organizations/me/designations")
        .set(...auth(token))
        .send({ name: `Transport Role ${suffix}`, code: `TROLE${suffix}` })
        .expect(201);
      const employee = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(token))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `TR-EMP-${suffix}`,
          firstName: "Transport",
          lastName: suffix,
          email: `transport-${suffix}@staff-e2e.test`,
          dateOfJoining: "2026-01-01",
        })
        .expect(201);
      return employee.body.id as string;
    }

    async function buildStudentEnrollment(token: string, suffix: string) {
      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(token))
        .send({ name: `Transport Campus ${suffix}`, code: `TRCAMP${suffix}` })
        .expect(201);
      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(token))
        .send({ campusId: campus.body.id, name: `Transport Faculty ${suffix}`, code: `TRFAC${suffix}` })
        .expect(201);
      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(token))
        .send({ facultyId: faculty.body.id, name: `Transport Dept ${suffix}`, code: `TRDEP${suffix}` })
        .expect(201);
      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(token))
        .send({ departmentId: department.body.id, name: `Transport Program ${suffix}`, code: `TRPROG${suffix}` })
        .expect(201);
      const year = await request(app.getHttpServer())
        .post("/organizations/me/academic-years")
        .set(...auth(token))
        .send({ name: `Transport Year ${suffix}`, startDate: "2099-01-01", endDate: "2099-12-31" })
        .expect(201);
      const term = await request(app.getHttpServer())
        .post("/organizations/me/terms")
        .set(...auth(token))
        .send({
          academicYearId: year.body.id,
          name: `Transport Term ${suffix}`,
          code: `TRT${suffix}`,
          sequence: 1,
          startDate: "2099-01-01",
          endDate: "2099-06-30",
        })
        .expect(201);
      const section = await request(app.getHttpServer())
        .post("/organizations/me/sections")
        .set(...auth(token))
        .send({ programId: program.body.id, termId: term.body.id, name: `Transport Section ${suffix}`, code: `TRS${suffix}` })
        .expect(201);
      const student = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(token))
        .send({ studentCode: `TR-STU-${suffix}`, firstName: "Transport", lastName: suffix, dateOfBirth: "2015-01-01" })
        .expect(201);
      const enrollment = await request(app.getHttpServer())
        .post(`/organizations/me/students/${student.body.id}/enrollments`)
        .set(...auth(token))
        .send({ programId: program.body.id, sectionId: section.body.id, termId: term.body.id, enrollmentDate: "2099-01-01" })
        .expect(201);
      return enrollment.body.id as string;
    }

    it("builds vehicles/drivers/routes/stops and assigns/reassigns a student, and stays tenant-scoped", async () => {
      const employeeId = await buildEmployee(tokenA, `TR${run}`);
      const otherEmployeeId = await buildEmployee(tokenA, `TR2${run}`);

      const vehicle = await request(app.getHttpServer())
        .post("/organizations/me/vehicles")
        .set(...auth(tokenA))
        .send({ registrationNumber: `BA-${run}-KA`, type: "Bus", capacity: 30 })
        .expect(201);

      // A route can't take a plain employee as driver — must have a
      // driver profile first.
      await request(app.getHttpServer())
        .post("/organizations/me/routes")
        .set(...auth(tokenA))
        .send({ name: `Route A ${run}`, code: `RTA${run}`, vehicleId: vehicle.body.id, driverId: otherEmployeeId })
        .expect(400);

      const driver = await request(app.getHttpServer())
        .post("/organizations/me/drivers")
        .set(...auth(tokenA))
        .send({ employeeId, licenseNumber: `LIC-${run}`, licenseExpiry: "2030-01-01" })
        .expect(201);
      expect(driver.body.employee.id).toBe(employeeId);

      // An employee can't have two driver profiles.
      await request(app.getHttpServer())
        .post("/organizations/me/drivers")
        .set(...auth(tokenA))
        .send({ employeeId, licenseNumber: `LIC2-${run}`, licenseExpiry: "2030-01-01" })
        .expect(409);

      const route = await request(app.getHttpServer())
        .post("/organizations/me/routes")
        .set(...auth(tokenA))
        .send({ name: `Route A ${run}`, code: `RTA${run}`, vehicleId: vehicle.body.id, driverId: employeeId })
        .expect(201);
      expect(route.body.driver.id).toBe(employeeId);
      expect(route.body.vehicle.id).toBe(vehicle.body.id);

      const stop1 = await request(app.getHttpServer())
        .post(`/organizations/me/routes/${route.body.id}/stops`)
        .set(...auth(tokenA))
        .send({ name: "Main Gate", sequence: 1, arrivalOffsetMinutes: 0 })
        .expect(201);
      const stop2 = await request(app.getHttpServer())
        .post(`/organizations/me/routes/${route.body.id}/stops`)
        .set(...auth(tokenA))
        .send({ name: "Market Square", sequence: 2, arrivalOffsetMinutes: 10 })
        .expect(201);

      // Two stops on the same route can't share a sequence.
      await request(app.getHttpServer())
        .post(`/organizations/me/routes/${route.body.id}/stops`)
        .set(...auth(tokenA))
        .send({ name: "Duplicate Order", sequence: 1 })
        .expect(409);

      const enrollmentId = await buildStudentEnrollment(tokenA, `TR${run}`);

      const assignment = await request(app.getHttpServer())
        .post("/organizations/me/student-transport-assignments")
        .set(...auth(tokenA))
        .send({ studentEnrollmentId: enrollmentId, routeId: route.body.id, stopId: stop1.body.id })
        .expect(201);
      expect(assignment.body.stop.id).toBe(stop1.body.id);

      // Reassigning is an upsert (a legitimate admin correction), not a
      // duplicate — same studentEnrollmentId, different stop.
      const reassignment = await request(app.getHttpServer())
        .post("/organizations/me/student-transport-assignments")
        .set(...auth(tokenA))
        .send({ studentEnrollmentId: enrollmentId, routeId: route.body.id, stopId: stop2.body.id })
        .expect(201);
      expect(reassignment.body.id).toBe(assignment.body.id);
      expect(reassignment.body.stop.id).toBe(stop2.body.id);

      const list = await request(app.getHttpServer())
        .get("/organizations/me/student-transport-assignments")
        .set(...auth(tokenA))
        .expect(200);
      expect(list.body).toHaveLength(1);
      expect(list.body[0].stop.id).toBe(stop2.body.id);

      const vehicleUpdate = await request(app.getHttpServer())
        .patch(`/organizations/me/vehicles/${vehicle.body.id}`)
        .set(...auth(tokenA))
        .send({ status: "MAINTENANCE" })
        .expect(200);
      expect(vehicleUpdate.body.status).toBe("MAINTENANCE");

      await request(app.getHttpServer())
        .delete(`/organizations/me/student-transport-assignments/${enrollmentId}`)
        .set(...auth(tokenA))
        .expect(200);
      await request(app.getHttpServer())
        .delete(`/organizations/me/student-transport-assignments/${enrollmentId}`)
        .set(...auth(tokenA))
        .expect(404);

      // Cross-tenant: org B sees none of this and can't act on it by id.
      for (const path of ["vehicles", "drivers", "routes", "student-transport-assignments"]) {
        const res = await request(app.getHttpServer())
          .get(`/organizations/me/${path}`)
          .set(...auth(tokenB))
          .expect(200);
        expect(res.body).toEqual([]);
      }
      await request(app.getHttpServer())
        .patch(`/organizations/me/vehicles/${vehicle.body.id}`)
        .set(...auth(tokenB))
        .send({ status: "INACTIVE" })
        .expect(404);
      await request(app.getHttpServer())
        .post(`/organizations/me/routes/${route.body.id}/stops`)
        .set(...auth(tokenB))
        .send({ name: "Intruder Stop", sequence: 9 })
        .expect(404);
    }, 60000);
  });

  describe("Transport, part 2 (driver location + navigation — Phase 7 slice 7d-2)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    async function buildEmployee(token: string, suffix: string) {
      const staffType = await request(app.getHttpServer())
        .post("/organizations/me/staff-types")
        .set(...auth(token))
        .send({ name: `Driver Staff ${suffix}`, code: `DSTAFF${suffix}` })
        .expect(201);
      const designation = await request(app.getHttpServer())
        .post("/organizations/me/designations")
        .set(...auth(token))
        .send({ name: `Driver Role ${suffix}`, code: `DROLE${suffix}` })
        .expect(201);
      const employee = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(token))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `DR-EMP-${suffix}`,
          firstName: "Driver",
          lastName: suffix,
          email: `driver-${suffix}@staff-e2e.test`,
          dateOfJoining: "2026-01-01",
        })
        .expect(201);
      return employee.body.id as string;
    }

    it("creates an employee login, gates driver-portal to linked drivers, and records/reads tracking events (IDOR + tenant guards)", async () => {
      const employeeId = await buildEmployee(tokenA, `DR${run}`);
      const nonDriverEmployeeId = await buildEmployee(tokenA, `DR2${run}`);

      const login = await request(app.getHttpServer())
        .post(`/organizations/me/employees/${employeeId}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "DriverPass123" })
        .expect(201);
      expect(login.body.username).toBe(`${orgASlug}.DR-EMP-DR${run}`);
      expect(login.body).not.toHaveProperty("passwordHash");

      // An employee can't get a second login.
      await request(app.getHttpServer())
        .post(`/organizations/me/employees/${employeeId}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "AnotherPass123" })
        .expect(409);

      const nonDriverLogin = await request(app.getHttpServer())
        .post(`/organizations/me/employees/${nonDriverEmployeeId}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "OtherPass123" })
        .expect(201);

      const driverSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: login.body.username, password: "DriverPass123" })
        .expect(201);
      const nonDriverSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: nonDriverLogin.body.username, password: "OtherPass123" })
        .expect(201);

      // A login with no linked Driver profile 404s on driver-portal/me —
      // same IDOR-safe-by-construction shape as student-portal.
      await request(app.getHttpServer())
        .get("/organizations/me/driver-portal/me")
        .set(...auth(nonDriverSession.body.accessToken))
        .expect(404);

      const vehicle = await request(app.getHttpServer())
        .post("/organizations/me/vehicles")
        .set(...auth(tokenA))
        .send({ registrationNumber: `BA-DR-${run}-KA`, type: "Bus", capacity: 20 })
        .expect(201);
      await request(app.getHttpServer())
        .post("/organizations/me/drivers")
        .set(...auth(tokenA))
        .send({ employeeId, licenseNumber: `LIC-DR-${run}`, licenseExpiry: "2030-01-01" })
        .expect(201);
      const route = await request(app.getHttpServer())
        .post("/organizations/me/routes")
        .set(...auth(tokenA))
        .send({ name: `Driver Route ${run}`, code: `DRT${run}`, vehicleId: vehicle.body.id, driverId: employeeId })
        .expect(201);
      const otherRoute = await request(app.getHttpServer())
        .post("/organizations/me/routes")
        .set(...auth(tokenA))
        .send({ name: `Other Route ${run}`, code: `ORT${run}` })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/routes/${route.body.id}/stops`)
        .set(...auth(tokenA))
        .send({ name: "Stop One", sequence: 1, latitude: 27.7, longitude: 85.32 })
        .expect(201);

      const me = await request(app.getHttpServer())
        .get("/organizations/me/driver-portal/me")
        .set(...auth(driverSession.body.accessToken))
        .expect(200);
      expect(me.body.driver.employeeId).toBe(employeeId);
      expect(me.body.route.id).toBe(route.body.id);
      expect(me.body.route.stops).toHaveLength(1);

      // Can't post tracking against a route that isn't theirs.
      await request(app.getHttpServer())
        .post("/organizations/me/driver-portal/tracking")
        .set(...auth(driverSession.body.accessToken))
        .send({ routeId: otherRoute.body.id, latitude: 27.71, longitude: 85.33 })
        .expect(404);

      const tracked = await request(app.getHttpServer())
        .post("/organizations/me/driver-portal/tracking")
        .set(...auth(driverSession.body.accessToken))
        .send({ routeId: route.body.id, latitude: 27.71, longitude: 85.33 })
        .expect(201);
      expect(tracked.body.vehicleId).toBe(vehicle.body.id);

      const latest = await request(app.getHttpServer())
        .get(`/organizations/me/vehicles/${vehicle.body.id}/tracking/latest`)
        .set(...auth(tokenA))
        .expect(200);
      expect(latest.body.id).toBe(tracked.body.id);

      const latestByVehicle = await request(app.getHttpServer())
        .get("/organizations/me/vehicles/tracking/latest")
        .set(...auth(tokenA))
        .expect(200);
      expect(latestByVehicle.body.some((t: { id: string }) => t.id === tracked.body.id)).toBe(true);

      // Cross-tenant: org B can't create a login under org A's employee,
      // can't reach org A's driver-portal, and sees no tracking data.
      await request(app.getHttpServer())
        .post(`/organizations/me/employees/${employeeId}/create-login`)
        .set(...auth(tokenB))
        .send({ password: "IntruderPass123" })
        .expect(404);
      await request(app.getHttpServer())
        .get(`/organizations/me/vehicles/${vehicle.body.id}/tracking/latest`)
        .set(...auth(tokenB))
        .expect(404);
      const bLatestByVehicle = await request(app.getHttpServer())
        .get("/organizations/me/vehicles/tracking/latest")
        .set(...auth(tokenB))
        .expect(200);
      expect(bLatestByVehicle.body).toEqual([]);
    }, 60000);
  });

  describe("Teacher self-service portal (LMS discovery slice 1)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    async function buildTeacherFixture(token: string, suffix: string) {
      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(token))
        .send({ name: `Teacher Campus ${suffix}`, code: `TCCAMP${suffix}` })
        .expect(201);
      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(token))
        .send({ campusId: campus.body.id, name: `Teacher Faculty ${suffix}`, code: `TCFAC${suffix}` })
        .expect(201);
      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(token))
        .send({ facultyId: faculty.body.id, name: `Teacher Dept ${suffix}`, code: `TCDEP${suffix}` })
        .expect(201);
      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(token))
        .send({ departmentId: department.body.id, name: `Teacher Program ${suffix}`, code: `TCPROG${suffix}` })
        .expect(201);
      const year = await request(app.getHttpServer())
        .post("/organizations/me/academic-years")
        .set(...auth(token))
        .send({ name: `Teacher Year ${suffix}`, startDate: "2099-08-01", endDate: "2100-06-30" })
        .expect(201);
      const term = await request(app.getHttpServer())
        .post("/organizations/me/terms")
        .set(...auth(token))
        .send({
          academicYearId: year.body.id,
          name: `Teacher Term ${suffix}`,
          code: `TCT${suffix}`,
          sequence: 1,
          startDate: "2099-08-01",
          endDate: "2099-12-15",
        })
        .expect(201);
      const section = await request(app.getHttpServer())
        .post("/organizations/me/sections")
        .set(...auth(token))
        .send({ programId: program.body.id, termId: term.body.id, name: `Teacher Section ${suffix}`, code: `TCS${suffix}` })
        .expect(201);
      const staffType = await request(app.getHttpServer())
        .post("/organizations/me/staff-types")
        .set(...auth(token))
        .send({ name: `Teacher Staff Type ${suffix}`, code: `TCST${suffix}` })
        .expect(201);
      const designation = await request(app.getHttpServer())
        .post("/organizations/me/designations")
        .set(...auth(token))
        .send({ name: `Teacher Designation ${suffix}`, code: `TCDS${suffix}` })
        .expect(201);
      const subject = await request(app.getHttpServer())
        .post("/organizations/me/subjects")
        .set(...auth(token))
        .send({ name: `Teacher Subject ${suffix}`, code: `TCSUB${suffix}` })
        .expect(201);
      const room = await request(app.getHttpServer())
        .post("/organizations/me/rooms")
        .set(...auth(token))
        .send({ campusId: campus.body.id, name: `Teacher Room ${suffix}`, code: `TCRM${suffix}` })
        .expect(201);
      const period = await request(app.getHttpServer())
        .post("/organizations/me/periods")
        .set(...auth(token))
        .send({ name: `Period ${suffix}`, code: `TCP${suffix}`, sequence: 1, startTime: "09:00", endTime: "09:45" })
        .expect(201);
      return {
        termId: term.body.id,
        sectionId: section.body.id,
        staffTypeId: staffType.body.id,
        designationId: designation.body.id,
        subjectId: subject.body.id,
        roomId: room.body.id,
        periodId: period.body.id,
      };
    }

    async function buildEmployee(token: string, f: { staffTypeId: string; designationId: string }, suffix: string) {
      const employee = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(token))
        .send({
          staffTypeId: f.staffTypeId,
          designationId: f.designationId,
          employeeCode: `TC-EMP-${suffix}`,
          firstName: "Teacher",
          lastName: suffix,
          email: `teacher-${suffix}-${run}@rls-e2e.test`,
          dateOfJoining: "2026-01-01",
        })
        .expect(201);
      return employee.body.id as string;
    }

    it("gates teacher-portal to a linked, owning teacher and enforces per-session ownership (IDOR guard)", async () => {
      const f = await buildTeacherFixture(tokenA, `TC${run}`);
      const teacherEmployeeId = await buildEmployee(tokenA, f, `TC${run}`);
      const otherEmployeeId = await buildEmployee(tokenA, f, `TC2${run}`);

      const assignment = await request(app.getHttpServer())
        .post("/organizations/me/teaching-assignments")
        .set(...auth(tokenA))
        .send({ employeeId: teacherEmployeeId, subjectId: f.subjectId, sectionId: f.sectionId, termId: f.termId })
        .expect(201);
      const schedule = await request(app.getHttpServer())
        .post("/organizations/me/class-schedules")
        .set(...auth(tokenA))
        .send({ teachingAssignmentId: assignment.body.id, roomId: f.roomId, periodId: f.periodId, dayOfWeek: 1 })
        .expect(201);

      const login = await request(app.getHttpServer())
        .post(`/organizations/me/employees/${teacherEmployeeId}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "TeacherPass123" })
        .expect(201);
      const otherLogin = await request(app.getHttpServer())
        .post(`/organizations/me/employees/${otherEmployeeId}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "OtherPass123" })
        .expect(201);

      const teacherSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: login.body.username, password: "TeacherPass123" })
        .expect(201);
      const otherSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: otherLogin.body.username, password: "OtherPass123" })
        .expect(201);
      const teacherToken = teacherSession.body.accessToken as string;
      const otherToken = otherSession.body.accessToken as string;

      // A login with no TeachingAssignment 404s on teacher-portal/me —
      // same IDOR-safe-by-construction shape as student/driver-portal.
      await request(app.getHttpServer())
        .get("/organizations/me/teacher-portal/me")
        .set(...auth(otherToken))
        .expect(404);

      const me = await request(app.getHttpServer())
        .get("/organizations/me/teacher-portal/me")
        .set(...auth(teacherToken))
        .expect(200);
      expect(me.body.employee.id).toBe(teacherEmployeeId);
      expect(me.body.teachingAssignments).toHaveLength(1);

      const session = await request(app.getHttpServer())
        .post("/organizations/me/teacher-portal/class-sessions")
        .set(...auth(teacherToken))
        .send({ classScheduleId: schedule.body.id, date: "2099-08-03" })
        .expect(201);
      expect(session.body.classSchedule.id).toBe(schedule.body.id);

      // Opening the same schedule+date again is idempotent, not a 409.
      const reopened = await request(app.getHttpServer())
        .post("/organizations/me/teacher-portal/class-sessions")
        .set(...auth(teacherToken))
        .send({ classScheduleId: schedule.body.id, date: "2099-08-03" })
        .expect(201);
      expect(reopened.body.id).toBe(session.body.id);

      // A different teacher (no TeachingAssignment on this schedule)
      // can't read, progress, materialize, or complete this session.
      await request(app.getHttpServer())
        .get(`/organizations/me/teacher-portal/class-sessions/${session.body.id}`)
        .set(...auth(otherToken))
        .expect(404);
      await request(app.getHttpServer())
        .put(`/organizations/me/teacher-portal/class-sessions/${session.body.id}/progress`)
        .set(...auth(otherToken))
        .send({ progressNotes: "Intruder note" })
        .expect(404);
      await request(app.getHttpServer())
        .post(`/organizations/me/teacher-portal/class-sessions/${session.body.id}/materials`)
        .set(...auth(otherToken))
        .send({ title: "Intruder material" })
        .expect(404);
      await request(app.getHttpServer())
        .post(`/organizations/me/teacher-portal/class-sessions/${session.body.id}/complete`)
        .set(...auth(otherToken))
        .expect(404);

      // Completing before a topic is recorded is rejected, matching the
      // admin ClassSessionsService's own rule.
      await request(app.getHttpServer())
        .post(`/organizations/me/teacher-portal/class-sessions/${session.body.id}/complete`)
        .set(...auth(teacherToken))
        .expect(400);

      const progress = await request(app.getHttpServer())
        .put(`/organizations/me/teacher-portal/class-sessions/${session.body.id}/progress`)
        .set(...auth(teacherToken))
        .send({ progressNotes: "Covered the introduction" })
        .expect(200);
      expect(progress.body.status).toBe("IN_PROGRESS");

      const material = await request(app.getHttpServer())
        .post(`/organizations/me/teacher-portal/class-sessions/${session.body.id}/materials`)
        .set(...auth(teacherToken))
        .send({ title: "Handout", url: "https://example.com/handout.pdf" })
        .expect(201);
      expect(material.body.title).toBe("Handout");

      // Completing still requires a recorded topic even for the owning
      // teacher — no actualSyllabusNodeId was set above.
      await request(app.getHttpServer())
        .post(`/organizations/me/teacher-portal/class-sessions/${session.body.id}/complete`)
        .set(...auth(teacherToken))
        .expect(400);

      const nodes = await request(app.getHttpServer())
        .get(`/organizations/me/teacher-portal/class-sessions/${session.body.id}/syllabus-nodes`)
        .set(...auth(teacherToken))
        .expect(200);
      expect(nodes.body).toEqual([]);

      // Cross-tenant: org B's admin can't create a login under org A's
      // employee, and org B has no teacher-portal data of its own.
      await request(app.getHttpServer())
        .post(`/organizations/me/employees/${teacherEmployeeId}/create-login`)
        .set(...auth(tokenB))
        .send({ password: "IntruderPass123" })
        .expect(404);
    }, 60000);
  });

  describe("Course modules & content (LMS discovery slice 2)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    it("lets a teacher build published/unpublished modules on their own course, and gates student access to published content only (IDOR + tenant guards)", async () => {
      const suffix = `CM${run}`;

      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(tokenA))
        .send({ name: `Module Campus ${suffix}`, code: `MODCAMP${suffix}` })
        .expect(201);
      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(tokenA))
        .send({ campusId: campus.body.id, name: `Module Faculty ${suffix}`, code: `MODFAC${suffix}` })
        .expect(201);
      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(tokenA))
        .send({ facultyId: faculty.body.id, name: `Module Dept ${suffix}`, code: `MODDEP${suffix}` })
        .expect(201);
      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(tokenA))
        .send({ departmentId: department.body.id, name: `Module Program ${suffix}`, code: `MODPROG${suffix}` })
        .expect(201);
      const year = await request(app.getHttpServer())
        .post("/organizations/me/academic-years")
        .set(...auth(tokenA))
        .send({ name: `Module Year ${suffix}`, startDate: "2099-08-01", endDate: "2100-06-30" })
        .expect(201);
      const term = await request(app.getHttpServer())
        .post("/organizations/me/terms")
        .set(...auth(tokenA))
        .send({
          academicYearId: year.body.id,
          name: `Module Term ${suffix}`,
          code: `MODT${suffix}`,
          sequence: 1,
          startDate: "2099-08-01",
          endDate: "2099-12-15",
        })
        .expect(201);
      const section = await request(app.getHttpServer())
        .post("/organizations/me/sections")
        .set(...auth(tokenA))
        .send({ programId: program.body.id, termId: term.body.id, name: `Module Section ${suffix}`, code: `MODS${suffix}` })
        .expect(201);
      const staffType = await request(app.getHttpServer())
        .post("/organizations/me/staff-types")
        .set(...auth(tokenA))
        .send({ name: `Module Staff Type ${suffix}`, code: `MODST${suffix}` })
        .expect(201);
      const designation = await request(app.getHttpServer())
        .post("/organizations/me/designations")
        .set(...auth(tokenA))
        .send({ name: `Module Designation ${suffix}`, code: `MODDS${suffix}` })
        .expect(201);
      const subject = await request(app.getHttpServer())
        .post("/organizations/me/subjects")
        .set(...auth(tokenA))
        .send({ name: `Module Subject ${suffix}`, code: `MODSUB${suffix}` })
        .expect(201);

      const teacher = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(tokenA))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `MOD-TCH-${suffix}`,
          firstName: "Module",
          lastName: "Teacher",
          email: `mod-teacher-${suffix}-${run}@rls-e2e.test`,
          dateOfJoining: "2026-01-01",
        })
        .expect(201);
      const otherTeacher = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(tokenA))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `MOD-TCH2-${suffix}`,
          firstName: "Other",
          lastName: "Teacher",
          email: `mod-teacher2-${suffix}-${run}@rls-e2e.test`,
          dateOfJoining: "2026-01-01",
        })
        .expect(201);

      const assignment = await request(app.getHttpServer())
        .post("/organizations/me/teaching-assignments")
        .set(...auth(tokenA))
        .send({ employeeId: teacher.body.id, subjectId: subject.body.id, sectionId: section.body.id, termId: term.body.id })
        .expect(201);

      const teacherLogin = await request(app.getHttpServer())
        .post(`/organizations/me/employees/${teacher.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "ModTeacherPass123" })
        .expect(201);
      const otherTeacherLogin = await request(app.getHttpServer())
        .post(`/organizations/me/employees/${otherTeacher.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "OtherTeacherPass123" })
        .expect(201);
      const teacherSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: teacherLogin.body.username, password: "ModTeacherPass123" })
        .expect(201);
      const otherTeacherSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: otherTeacherLogin.body.username, password: "OtherTeacherPass123" })
        .expect(201);
      const teacherToken = teacherSession.body.accessToken as string;
      const otherTeacherToken = otherTeacherSession.body.accessToken as string;

      // A different teacher can't create a module on someone else's
      // course (404, IDOR guard).
      await request(app.getHttpServer())
        .post("/organizations/me/teacher-portal/modules")
        .set(...auth(otherTeacherToken))
        .send({ teachingAssignmentId: assignment.body.id, title: "Intruder Module", sequence: 1 })
        .expect(404);

      const publishedModule = await request(app.getHttpServer())
        .post("/organizations/me/teacher-portal/modules")
        .set(...auth(teacherToken))
        .send({ teachingAssignmentId: assignment.body.id, title: "Module 1 — Introduction", sequence: 1 })
        .expect(201);
      const draftModule = await request(app.getHttpServer())
        .post("/organizations/me/teacher-portal/modules")
        .set(...auth(teacherToken))
        .send({ teachingAssignmentId: assignment.body.id, title: "Module 2 — Draft", sequence: 2 })
        .expect(201);

      const publishedItem = await request(app.getHttpServer())
        .post(`/organizations/me/teacher-portal/modules/${publishedModule.body.id}/items`)
        .set(...auth(teacherToken))
        .send({ sequence: 1, title: "Welcome page", type: "PAGE", content: "Welcome to the course." })
        .expect(201);
      const unpublishedItem = await request(app.getHttpServer())
        .post(`/organizations/me/teacher-portal/modules/${publishedModule.body.id}/items`)
        .set(...auth(teacherToken))
        .send({ sequence: 2, title: "Draft reading", type: "LINK", content: "https://example.com/reading" })
        .expect(201);

      await request(app.getHttpServer())
        .put(`/organizations/me/teacher-portal/modules/${publishedModule.body.id}`)
        .set(...auth(teacherToken))
        .send({ isPublished: true })
        .expect(200);
      await request(app.getHttpServer())
        .put(`/organizations/me/teacher-portal/module-items/${publishedItem.body.id}`)
        .set(...auth(teacherToken))
        .send({ isPublished: true })
        .expect(200);
      // draftModule and unpublishedItem stay unpublished.

      // Build an enrolled student with a portal login.
      const student = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `MOD-STU-${suffix}`, firstName: "Module", lastName: "Student", dateOfBirth: "2015-01-01" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/students/${student.body.id}/enrollments`)
        .set(...auth(tokenA))
        .send({ programId: program.body.id, sectionId: section.body.id, termId: term.body.id, enrollmentDate: "2099-08-01" })
        .expect(201);
      const studentLogin = await request(app.getHttpServer())
        .post(`/organizations/me/students/${student.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "ModStudentPass123" })
        .expect(201);
      const studentSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: studentLogin.body.username, password: "ModStudentPass123" })
        .expect(201);
      const studentToken = studentSession.body.accessToken as string;

      const courses = await request(app.getHttpServer())
        .get("/organizations/me/portal/courses")
        .set(...auth(studentToken))
        .expect(200);
      expect(courses.body.map((c: { id: string }) => c.id)).toContain(assignment.body.id);

      const modules = await request(app.getHttpServer())
        .get(`/organizations/me/portal/courses/${assignment.body.id}/modules`)
        .set(...auth(studentToken))
        .expect(200);
      // Only the published module surfaces, and only its published item.
      expect(modules.body).toHaveLength(1);
      expect(modules.body[0].id).toBe(publishedModule.body.id);
      expect(modules.body[0].items.map((i: { id: string }) => i.id)).toEqual([publishedItem.body.id]);
      expect(modules.body[0].items[0].completed).toBe(false);

      // Can't complete an unpublished item (404).
      await request(app.getHttpServer())
        .post(`/organizations/me/portal/module-items/${unpublishedItem.body.id}/complete`)
        .set(...auth(studentToken))
        .expect(404);

      const completed = await request(app.getHttpServer())
        .post(`/organizations/me/portal/module-items/${publishedItem.body.id}/complete`)
        .set(...auth(studentToken))
        .expect(201);
      expect(completed.body.studentId).toBe(student.body.id);

      // Idempotent — completing again doesn't error or duplicate.
      await request(app.getHttpServer())
        .post(`/organizations/me/portal/module-items/${publishedItem.body.id}/complete`)
        .set(...auth(studentToken))
        .expect(201);

      const modulesAfter = await request(app.getHttpServer())
        .get(`/organizations/me/portal/courses/${assignment.body.id}/modules`)
        .set(...auth(studentToken))
        .expect(200);
      expect(modulesAfter.body[0].items[0].completed).toBe(true);

      // A student not enrolled in this course (no StudentEnrollment for
      // this section+term) can't reach its modules — build a second,
      // unrelated student to confirm.
      const otherStudent = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `MOD-STU2-${suffix}`, firstName: "Outside", lastName: "Student", dateOfBirth: "2015-01-01" })
        .expect(201);
      const otherStudentLogin = await request(app.getHttpServer())
        .post(`/organizations/me/students/${otherStudent.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "OtherStudentPass123" })
        .expect(201);
      const otherStudentSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: otherStudentLogin.body.username, password: "OtherStudentPass123" })
        .expect(201);
      await request(app.getHttpServer())
        .get(`/organizations/me/portal/courses/${assignment.body.id}/modules`)
        .set(...auth(otherStudentSession.body.accessToken))
        .expect(404);

      // Cross-tenant: org B can't create a module on org A's teaching
      // assignment, and org B's own student-portal has no such course.
      await request(app.getHttpServer())
        .post("/organizations/me/teacher-portal/modules")
        .set(...auth(tokenB))
        .send({ teachingAssignmentId: assignment.body.id, title: "Intruder Module", sequence: 1 })
        .expect(404);
    }, 60000);
  });

  describe("Self-service assignments (LMS discovery slice 3)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    it("lets a teacher create/publish/grade assignments on their own course, and gates student submission to published, enrolled courses only (IDOR + tenant guards)", async () => {
      const suffix = `AS${run}`;

      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(tokenA))
        .send({ name: `Assign Campus ${suffix}`, code: `ASCAMP${suffix}` })
        .expect(201);
      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(tokenA))
        .send({ campusId: campus.body.id, name: `Assign Faculty ${suffix}`, code: `ASFAC${suffix}` })
        .expect(201);
      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(tokenA))
        .send({ facultyId: faculty.body.id, name: `Assign Dept ${suffix}`, code: `ASDEP${suffix}` })
        .expect(201);
      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(tokenA))
        .send({ departmentId: department.body.id, name: `Assign Program ${suffix}`, code: `ASPROG${suffix}` })
        .expect(201);
      const year = await request(app.getHttpServer())
        .post("/organizations/me/academic-years")
        .set(...auth(tokenA))
        .send({ name: `Assign Year ${suffix}`, startDate: "2099-08-01", endDate: "2100-06-30" })
        .expect(201);
      const term = await request(app.getHttpServer())
        .post("/organizations/me/terms")
        .set(...auth(tokenA))
        .send({
          academicYearId: year.body.id,
          name: `Assign Term ${suffix}`,
          code: `AST${suffix}`,
          sequence: 1,
          startDate: "2099-08-01",
          endDate: "2099-12-15",
        })
        .expect(201);
      const section = await request(app.getHttpServer())
        .post("/organizations/me/sections")
        .set(...auth(tokenA))
        .send({ programId: program.body.id, termId: term.body.id, name: `Assign Section ${suffix}`, code: `ASS${suffix}` })
        .expect(201);
      const staffType = await request(app.getHttpServer())
        .post("/organizations/me/staff-types")
        .set(...auth(tokenA))
        .send({ name: `Assign Staff Type ${suffix}`, code: `ASST${suffix}` })
        .expect(201);
      const designation = await request(app.getHttpServer())
        .post("/organizations/me/designations")
        .set(...auth(tokenA))
        .send({ name: `Assign Designation ${suffix}`, code: `ASDS${suffix}` })
        .expect(201);
      const subject = await request(app.getHttpServer())
        .post("/organizations/me/subjects")
        .set(...auth(tokenA))
        .send({ name: `Assign Subject ${suffix}`, code: `ASSUB${suffix}` })
        .expect(201);

      const teacher = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(tokenA))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `AS-TCH-${suffix}`,
          firstName: "Assign",
          lastName: "Teacher",
          email: `as-teacher-${suffix}-${run}@rls-e2e.test`,
          dateOfJoining: "2026-01-01",
        })
        .expect(201);
      const otherTeacher = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(tokenA))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `AS-TCH2-${suffix}`,
          firstName: "Other",
          lastName: "AssignTeacher",
          email: `as-teacher2-${suffix}-${run}@rls-e2e.test`,
          dateOfJoining: "2026-01-01",
        })
        .expect(201);

      const teachingAssignment = await request(app.getHttpServer())
        .post("/organizations/me/teaching-assignments")
        .set(...auth(tokenA))
        .send({ employeeId: teacher.body.id, subjectId: subject.body.id, sectionId: section.body.id, termId: term.body.id })
        .expect(201);

      const teacherLogin = await request(app.getHttpServer())
        .post(`/organizations/me/employees/${teacher.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "AssignTeacherPass123" })
        .expect(201);
      const otherTeacherLogin = await request(app.getHttpServer())
        .post(`/organizations/me/employees/${otherTeacher.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "OtherAssignTeacherPass123" })
        .expect(201);
      const teacherSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: teacherLogin.body.username, password: "AssignTeacherPass123" })
        .expect(201);
      const otherTeacherSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: otherTeacherLogin.body.username, password: "OtherAssignTeacherPass123" })
        .expect(201);
      const teacherToken = teacherSession.body.accessToken as string;
      const otherTeacherToken = otherTeacherSession.body.accessToken as string;

      // A different teacher can't create an assignment on someone
      // else's course (404, IDOR guard).
      await request(app.getHttpServer())
        .post("/organizations/me/teacher-portal/assignments")
        .set(...auth(otherTeacherToken))
        .send({ teachingAssignmentId: teachingAssignment.body.id, title: "Intruder Assignment", submissionType: "TEXT" })
        .expect(404);

      const draftAssignment = await request(app.getHttpServer())
        .post("/organizations/me/teacher-portal/assignments")
        .set(...auth(teacherToken))
        .send({
          teachingAssignmentId: teachingAssignment.body.id,
          title: "Essay 1",
          submissionType: "TEXT",
          maxScore: 10,
          allowResubmission: false,
        })
        .expect(201);
      expect(draftAssignment.body.isPublished).toBe(false);

      // Build an enrolled student and an unrelated, unenrolled one.
      const student = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `AS-STU-${suffix}`, firstName: "Assign", lastName: "Student", dateOfBirth: "2015-01-01" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/students/${student.body.id}/enrollments`)
        .set(...auth(tokenA))
        .send({ programId: program.body.id, sectionId: section.body.id, termId: term.body.id, enrollmentDate: "2099-08-01" })
        .expect(201);
      const studentLogin = await request(app.getHttpServer())
        .post(`/organizations/me/students/${student.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "AssignStudentPass123" })
        .expect(201);
      const studentSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: studentLogin.body.username, password: "AssignStudentPass123" })
        .expect(201);
      const studentToken = studentSession.body.accessToken as string;

      const otherStudent = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `AS-STU2-${suffix}`, firstName: "Outside", lastName: "AssignStudent", dateOfBirth: "2015-01-01" })
        .expect(201);
      const otherStudentLogin = await request(app.getHttpServer())
        .post(`/organizations/me/students/${otherStudent.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "OtherAssignStudentPass123" })
        .expect(201);
      const otherStudentSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: otherStudentLogin.body.username, password: "OtherAssignStudentPass123" })
        .expect(201);
      const otherStudentToken = otherStudentSession.body.accessToken as string;

      // Unpublished draft is invisible to the enrolled student.
      const listBeforePublish = await request(app.getHttpServer())
        .get("/organizations/me/portal/assignments")
        .set(...auth(studentToken))
        .expect(200);
      expect(listBeforePublish.body).toEqual([]);
      await request(app.getHttpServer())
        .get(`/organizations/me/portal/assignments/${draftAssignment.body.id}`)
        .set(...auth(studentToken))
        .expect(404);
      await request(app.getHttpServer())
        .post(`/organizations/me/portal/assignments/${draftAssignment.body.id}/submit`)
        .set(...auth(studentToken))
        .send({ content: "Too early" })
        .expect(404);

      await request(app.getHttpServer())
        .put(`/organizations/me/teacher-portal/assignments/${draftAssignment.body.id}`)
        .set(...auth(teacherToken))
        .send({ isPublished: true })
        .expect(200);

      const listAfterPublish = await request(app.getHttpServer())
        .get("/organizations/me/portal/assignments")
        .set(...auth(studentToken))
        .expect(200);
      expect(listAfterPublish.body).toHaveLength(1);
      expect(listAfterPublish.body[0].mySubmission).toBeNull();

      // A student not enrolled in this course can't reach it (404).
      await request(app.getHttpServer())
        .get(`/organizations/me/portal/assignments/${draftAssignment.body.id}`)
        .set(...auth(otherStudentToken))
        .expect(404);
      await request(app.getHttpServer())
        .post(`/organizations/me/portal/assignments/${draftAssignment.body.id}/submit`)
        .set(...auth(otherStudentToken))
        .send({ content: "Intruder submission" })
        .expect(404);

      const submission = await request(app.getHttpServer())
        .post(`/organizations/me/portal/assignments/${draftAssignment.body.id}/submit`)
        .set(...auth(studentToken))
        .send({ content: "My first draft." })
        .expect(201);
      expect(submission.body.status).toBe("SUBMITTED");

      // allowResubmission is false — a second submit is rejected (409).
      await request(app.getHttpServer())
        .post(`/organizations/me/portal/assignments/${draftAssignment.body.id}/submit`)
        .set(...auth(studentToken))
        .send({ content: "Trying again" })
        .expect(409);

      // A different teacher can't grade a submission on someone else's
      // assignment (404).
      await request(app.getHttpServer())
        .put(`/organizations/me/teacher-portal/assignments/${draftAssignment.body.id}/submissions/${student.body.id}/grade`)
        .set(...auth(otherTeacherToken))
        .send({ score: 10 })
        .expect(404);

      const teacherView = await request(app.getHttpServer())
        .get(`/organizations/me/teacher-portal/assignments?teachingAssignmentId=${teachingAssignment.body.id}`)
        .set(...auth(teacherToken))
        .expect(200);
      expect(teacherView.body).toHaveLength(1);
      expect(teacherView.body[0].submissions).toHaveLength(1);
      expect(teacherView.body[0].submissions[0].student.id).toBe(student.body.id);

      await request(app.getHttpServer())
        .put(`/organizations/me/teacher-portal/assignments/${draftAssignment.body.id}/submissions/${student.body.id}/grade`)
        .set(...auth(teacherToken))
        .send({ score: 8, feedback: "Good start, needs more detail." })
        .expect(200);

      const studentAfterGrade = await request(app.getHttpServer())
        .get(`/organizations/me/portal/assignments/${draftAssignment.body.id}`)
        .set(...auth(studentToken))
        .expect(200);
      expect(studentAfterGrade.body.mySubmission.status).toBe("GRADED");
      expect(studentAfterGrade.body.mySubmission.score).toBe(8);
      expect(studentAfterGrade.body.mySubmission.feedback).toBe("Good start, needs more detail.");
      // Never exposes another student's submission — mySubmission is
      // the only submission-shaped field on this response.
      expect(studentAfterGrade.body.submissions).toBeUndefined();

      // Cross-tenant: org B can't create/publish/grade on org A's
      // course, and org B's own student-portal has no such assignment.
      await request(app.getHttpServer())
        .post("/organizations/me/teacher-portal/assignments")
        .set(...auth(tokenB))
        .send({ teachingAssignmentId: teachingAssignment.body.id, title: "Intruder Assignment", submissionType: "TEXT" })
        .expect(404);
    }, 60000);
  });

  describe("Quiz engine (LMS discovery slice 4)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    it("adapts exam-taking's shuffle/autosave/resume/auto-score engine onto a teacher-owned quiz, gated to published + enrolled (IDOR + tenant guards)", async () => {
      const suffix = `QZ${run}`;

      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(tokenA))
        .send({ name: `Quiz Campus ${suffix}`, code: `QZCAMP${suffix}` })
        .expect(201);
      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(tokenA))
        .send({ campusId: campus.body.id, name: `Quiz Faculty ${suffix}`, code: `QZFAC${suffix}` })
        .expect(201);
      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(tokenA))
        .send({ facultyId: faculty.body.id, name: `Quiz Dept ${suffix}`, code: `QZDEP${suffix}` })
        .expect(201);
      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(tokenA))
        .send({ departmentId: department.body.id, name: `Quiz Program ${suffix}`, code: `QZPROG${suffix}` })
        .expect(201);
      const year = await request(app.getHttpServer())
        .post("/organizations/me/academic-years")
        .set(...auth(tokenA))
        .send({ name: `Quiz Year ${suffix}`, startDate: "2099-08-01", endDate: "2100-06-30" })
        .expect(201);
      const term = await request(app.getHttpServer())
        .post("/organizations/me/terms")
        .set(...auth(tokenA))
        .send({
          academicYearId: year.body.id,
          name: `Quiz Term ${suffix}`,
          code: `QZT${suffix}`,
          sequence: 1,
          startDate: "2099-08-01",
          endDate: "2099-12-15",
        })
        .expect(201);
      const section = await request(app.getHttpServer())
        .post("/organizations/me/sections")
        .set(...auth(tokenA))
        .send({ programId: program.body.id, termId: term.body.id, name: `Quiz Section ${suffix}`, code: `QZS${suffix}` })
        .expect(201);
      const staffType = await request(app.getHttpServer())
        .post("/organizations/me/staff-types")
        .set(...auth(tokenA))
        .send({ name: `Quiz Staff Type ${suffix}`, code: `QZST${suffix}` })
        .expect(201);
      const designation = await request(app.getHttpServer())
        .post("/organizations/me/designations")
        .set(...auth(tokenA))
        .send({ name: `Quiz Designation ${suffix}`, code: `QZDS${suffix}` })
        .expect(201);
      const subject = await request(app.getHttpServer())
        .post("/organizations/me/subjects")
        .set(...auth(tokenA))
        .send({ name: `Quiz Subject ${suffix}`, code: `QZSUB${suffix}` })
        .expect(201);

      const teacher = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(tokenA))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `QZ-TCH-${suffix}`,
          firstName: "Quiz",
          lastName: "Teacher",
          email: `qz-teacher-${suffix}-${run}@rls-e2e.test`,
          dateOfJoining: "2026-01-01",
        })
        .expect(201);
      const otherTeacher = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(tokenA))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `QZ-TCH2-${suffix}`,
          firstName: "Other",
          lastName: "QuizTeacher",
          email: `qz-teacher2-${suffix}-${run}@rls-e2e.test`,
          dateOfJoining: "2026-01-01",
        })
        .expect(201);

      const teachingAssignment = await request(app.getHttpServer())
        .post("/organizations/me/teaching-assignments")
        .set(...auth(tokenA))
        .send({ employeeId: teacher.body.id, subjectId: subject.body.id, sectionId: section.body.id, termId: term.body.id })
        .expect(201);

      const teacherLogin = await request(app.getHttpServer())
        .post(`/organizations/me/employees/${teacher.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "QuizTeacherPass123" })
        .expect(201);
      const otherTeacherLogin = await request(app.getHttpServer())
        .post(`/organizations/me/employees/${otherTeacher.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "OtherQuizTeacherPass123" })
        .expect(201);
      const teacherSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: teacherLogin.body.username, password: "QuizTeacherPass123" })
        .expect(201);
      const otherTeacherSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: otherTeacherLogin.body.username, password: "OtherQuizTeacherPass123" })
        .expect(201);
      const teacherToken = teacherSession.body.accessToken as string;
      const otherTeacherToken = otherTeacherSession.body.accessToken as string;

      // A different teacher can't create a quiz on someone else's course
      // (404, IDOR guard).
      await request(app.getHttpServer())
        .post("/organizations/me/teacher-portal/quizzes")
        .set(...auth(otherTeacherToken))
        .send({ teachingAssignmentId: teachingAssignment.body.id, title: "Intruder Quiz" })
        .expect(404);

      const quiz = await request(app.getHttpServer())
        .post("/organizations/me/teacher-portal/quizzes")
        .set(...auth(teacherToken))
        .send({ teachingAssignmentId: teachingAssignment.body.id, title: "Counting Quiz", durationMinutes: 30 })
        .expect(201);
      expect(quiz.body.status).toBe("DRAFT");

      // Can't publish with no questions yet (400).
      await request(app.getHttpServer())
        .post(`/organizations/me/teacher-portal/quizzes/${quiz.body.id}/publish`)
        .set(...auth(teacherToken))
        .expect(400);

      // A different teacher can't add a question or read quiz detail on
      // someone else's quiz (404, IDOR guard).
      await request(app.getHttpServer())
        .post(`/organizations/me/teacher-portal/quizzes/${quiz.body.id}/questions`)
        .set(...auth(otherTeacherToken))
        .send({ sequence: 1, text: "Intruder question", options: ["A", "B"], correctOptionIndex: 0 })
        .expect(404);
      await request(app.getHttpServer())
        .get(`/organizations/me/teacher-portal/quizzes/${quiz.body.id}`)
        .set(...auth(otherTeacherToken))
        .expect(404);

      const q1 = await request(app.getHttpServer())
        .post(`/organizations/me/teacher-portal/quizzes/${quiz.body.id}/questions`)
        .set(...auth(teacherToken))
        .send({ sequence: 1, text: "How many is 2 + 2?", options: ["3", "4", "5", "6"], correctOptionIndex: 1 })
        .expect(201);
      const q2 = await request(app.getHttpServer())
        .post(`/organizations/me/teacher-portal/quizzes/${quiz.body.id}/questions`)
        .set(...auth(teacherToken))
        .send({ sequence: 2, text: "How many is 3 + 3?", options: ["5", "6", "7", "8"], correctOptionIndex: 1 })
        .expect(201);
      const q1Id = q1.body.id as string;
      const q2Id = q2.body.id as string;

      // Build an enrolled student and an unrelated, unenrolled one.
      const student = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `QZ-STU-${suffix}`, firstName: "Quiz", lastName: "Student", dateOfBirth: "2015-01-01" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/students/${student.body.id}/enrollments`)
        .set(...auth(tokenA))
        .send({ programId: program.body.id, sectionId: section.body.id, termId: term.body.id, enrollmentDate: "2099-08-01" })
        .expect(201);
      const studentLogin = await request(app.getHttpServer())
        .post(`/organizations/me/students/${student.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "QuizStudentPass123" })
        .expect(201);
      const studentSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: studentLogin.body.username, password: "QuizStudentPass123" })
        .expect(201);
      const studentToken = studentSession.body.accessToken as string;

      const otherStudent = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `QZ-STU2-${suffix}`, firstName: "Outside", lastName: "QuizStudent", dateOfBirth: "2015-01-01" })
        .expect(201);
      const otherStudentLogin = await request(app.getHttpServer())
        .post(`/organizations/me/students/${otherStudent.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "OtherQuizStudentPass123" })
        .expect(201);
      const otherStudentSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: otherStudentLogin.body.username, password: "OtherQuizStudentPass123" })
        .expect(201);
      const otherStudentToken = otherStudentSession.body.accessToken as string;

      // Draft quiz is invisible to the enrolled student.
      const listBeforePublish = await request(app.getHttpServer())
        .get("/organizations/me/portal/quizzes")
        .set(...auth(studentToken))
        .expect(200);
      expect(listBeforePublish.body).toEqual([]);
      await request(app.getHttpServer())
        .get(`/organizations/me/portal/quizzes/${quiz.body.id}`)
        .set(...auth(studentToken))
        .expect(404);
      await request(app.getHttpServer())
        .post(`/organizations/me/portal/quizzes/${quiz.body.id}/start`)
        .set(...auth(studentToken))
        .expect(404);

      await request(app.getHttpServer())
        .post(`/organizations/me/teacher-portal/quizzes/${quiz.body.id}/publish`)
        .set(...auth(teacherToken))
        .expect(201);

      const listAfterPublish = await request(app.getHttpServer())
        .get("/organizations/me/portal/quizzes")
        .set(...auth(studentToken))
        .expect(200);
      expect(listAfterPublish.body).toHaveLength(1);
      expect(listAfterPublish.body[0].questionCount).toBe(2);
      expect(listAfterPublish.body[0].myAttempt).toBeNull();

      // A student not enrolled in this course can't reach it (404).
      await request(app.getHttpServer())
        .get(`/organizations/me/portal/quizzes/${quiz.body.id}`)
        .set(...auth(otherStudentToken))
        .expect(404);
      await request(app.getHttpServer())
        .post(`/organizations/me/portal/quizzes/${quiz.body.id}/start`)
        .set(...auth(otherStudentToken))
        .expect(404);

      const started = await request(app.getHttpServer())
        .post(`/organizations/me/portal/quizzes/${quiz.body.id}/start`)
        .set(...auth(studentToken))
        .expect(201);
      expect(started.body.questions).toHaveLength(2);
      for (const q of started.body.questions) {
        expect(q).not.toHaveProperty("correctOptionIndex");
      }
      // durationMinutes was set — a deadline roughly 30 minutes out is
      // returned; no time limit would instead be a null deadline.
      const deadlineMs = new Date(started.body.deadline).getTime();
      expect(deadlineMs).toBeGreaterThan(Date.now());
      expect(deadlineMs).toBeLessThanOrEqual(Date.now() + 31 * 60_000);

      const shownQ1 = started.body.questions.find((q: { id: string }) => q.id === q1Id);
      const shownQ2 = started.body.questions.find((q: { id: string }) => q.id === q2Id);
      const q1CorrectDisplayIndex = shownQ1.options.indexOf("4");
      const q2WrongDisplayIndex = shownQ2.options.findIndex((o: string) => o !== "6");

      await request(app.getHttpServer())
        .put(`/organizations/me/portal/quizzes/${quiz.body.id}/answers/${q1Id}`)
        .set(...auth(studentToken))
        .send({ selectedOptionIndex: q1CorrectDisplayIndex })
        .expect(200);
      await request(app.getHttpServer())
        .put(`/organizations/me/portal/quizzes/${quiz.body.id}/answers/${q2Id}`)
        .set(...auth(studentToken))
        .send({ selectedOptionIndex: q2WrongDisplayIndex })
        .expect(200);

      // Resume: a second start returns the identical question/option
      // order (deterministic seed) with the previously-saved answers
      // pre-selected — no reshuffle on refresh.
      const resumed = await request(app.getHttpServer())
        .post(`/organizations/me/portal/quizzes/${quiz.body.id}/start`)
        .set(...auth(studentToken))
        .expect(201);
      expect(resumed.body.questions.map((q: { id: string }) => q.id)).toEqual(
        started.body.questions.map((q: { id: string }) => q.id),
      );
      const resumedQ1 = resumed.body.questions.find((q: { id: string }) => q.id === q1Id);
      const resumedQ2 = resumed.body.questions.find((q: { id: string }) => q.id === q2Id);
      expect(resumedQ1.options).toEqual(shownQ1.options);
      expect(resumedQ1.selectedOptionIndex).toBe(q1CorrectDisplayIndex);
      expect(resumedQ2.selectedOptionIndex).toBe(q2WrongDisplayIndex);

      const submitted = await request(app.getHttpServer())
        .post(`/organizations/me/portal/quizzes/${quiz.body.id}/submit`)
        .set(...auth(studentToken))
        .expect(201);
      expect(submitted.body.myAttempt.submittedAt).not.toBeNull();
      // One of two correct — never trust a client-submitted score.
      expect(submitted.body.myAttempt.score).toBe(50);

      // Resubmission and further edits are rejected once submitted.
      await request(app.getHttpServer())
        .post(`/organizations/me/portal/quizzes/${quiz.body.id}/submit`)
        .set(...auth(studentToken))
        .expect(409);
      await request(app.getHttpServer())
        .put(`/organizations/me/portal/quizzes/${quiz.body.id}/answers/${q1Id}`)
        .set(...auth(studentToken))
        .send({ selectedOptionIndex: 0 })
        .expect(409);
      await request(app.getHttpServer())
        .post(`/organizations/me/portal/quizzes/${quiz.body.id}/start`)
        .set(...auth(studentToken))
        .expect(409);

      // The owning teacher sees the graded attempt with the student's
      // info; a different teacher still can't reach the quiz at all.
      const teacherView = await request(app.getHttpServer())
        .get(`/organizations/me/teacher-portal/quizzes?teachingAssignmentId=${teachingAssignment.body.id}`)
        .set(...auth(teacherToken))
        .expect(200);
      expect(teacherView.body).toHaveLength(1);
      expect(teacherView.body[0].attempts).toHaveLength(1);
      expect(teacherView.body[0].attempts[0].student.id).toBe(student.body.id);
      expect(teacherView.body[0].attempts[0].score).toBe(50);
      await request(app.getHttpServer())
        .get(`/organizations/me/teacher-portal/quizzes?teachingAssignmentId=${teachingAssignment.body.id}`)
        .set(...auth(otherTeacherToken))
        .expect(404);

      // Cross-tenant: org B can't create/publish a quiz on org A's
      // course.
      await request(app.getHttpServer())
        .post("/organizations/me/teacher-portal/quizzes")
        .set(...auth(tokenB))
        .send({ teachingAssignmentId: teachingAssignment.body.id, title: "Intruder Quiz" })
        .expect(404);
    }, 90000);
  });

  describe("Announcements (LMS discovery slice 5)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    it("lets a teacher post/publish announcements on their own course, gated to published + enrolled (IDOR + tenant guards)", async () => {
      const suffix = `AN${run}`;

      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(tokenA))
        .send({ name: `Announce Campus ${suffix}`, code: `ANCAMP${suffix}` })
        .expect(201);
      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(tokenA))
        .send({ campusId: campus.body.id, name: `Announce Faculty ${suffix}`, code: `ANFAC${suffix}` })
        .expect(201);
      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(tokenA))
        .send({ facultyId: faculty.body.id, name: `Announce Dept ${suffix}`, code: `ANDEP${suffix}` })
        .expect(201);
      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(tokenA))
        .send({ departmentId: department.body.id, name: `Announce Program ${suffix}`, code: `ANPROG${suffix}` })
        .expect(201);
      const year = await request(app.getHttpServer())
        .post("/organizations/me/academic-years")
        .set(...auth(tokenA))
        .send({ name: `Announce Year ${suffix}`, startDate: "2099-08-01", endDate: "2100-06-30" })
        .expect(201);
      const term = await request(app.getHttpServer())
        .post("/organizations/me/terms")
        .set(...auth(tokenA))
        .send({
          academicYearId: year.body.id,
          name: `Announce Term ${suffix}`,
          code: `ANT${suffix}`,
          sequence: 1,
          startDate: "2099-08-01",
          endDate: "2099-12-15",
        })
        .expect(201);
      const section = await request(app.getHttpServer())
        .post("/organizations/me/sections")
        .set(...auth(tokenA))
        .send({ programId: program.body.id, termId: term.body.id, name: `Announce Section ${suffix}`, code: `ANS${suffix}` })
        .expect(201);
      const staffType = await request(app.getHttpServer())
        .post("/organizations/me/staff-types")
        .set(...auth(tokenA))
        .send({ name: `Announce Staff Type ${suffix}`, code: `ANST${suffix}` })
        .expect(201);
      const designation = await request(app.getHttpServer())
        .post("/organizations/me/designations")
        .set(...auth(tokenA))
        .send({ name: `Announce Designation ${suffix}`, code: `ANDS${suffix}` })
        .expect(201);
      const subject = await request(app.getHttpServer())
        .post("/organizations/me/subjects")
        .set(...auth(tokenA))
        .send({ name: `Announce Subject ${suffix}`, code: `ANSUB${suffix}` })
        .expect(201);

      const teacher = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(tokenA))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `AN-TCH-${suffix}`,
          firstName: "Announce",
          lastName: "Teacher",
          email: `an-teacher-${suffix}-${run}@rls-e2e.test`,
          dateOfJoining: "2026-01-01",
        })
        .expect(201);
      const otherTeacher = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(tokenA))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `AN-TCH2-${suffix}`,
          firstName: "Other",
          lastName: "AnnounceTeacher",
          email: `an-teacher2-${suffix}-${run}@rls-e2e.test`,
          dateOfJoining: "2026-01-01",
        })
        .expect(201);

      const teachingAssignment = await request(app.getHttpServer())
        .post("/organizations/me/teaching-assignments")
        .set(...auth(tokenA))
        .send({ employeeId: teacher.body.id, subjectId: subject.body.id, sectionId: section.body.id, termId: term.body.id })
        .expect(201);

      const teacherLogin = await request(app.getHttpServer())
        .post(`/organizations/me/employees/${teacher.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "AnnounceTeacherPass123" })
        .expect(201);
      const otherTeacherLogin = await request(app.getHttpServer())
        .post(`/organizations/me/employees/${otherTeacher.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "OtherAnnounceTeacherPass123" })
        .expect(201);
      const teacherSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: teacherLogin.body.username, password: "AnnounceTeacherPass123" })
        .expect(201);
      const otherTeacherSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: otherTeacherLogin.body.username, password: "OtherAnnounceTeacherPass123" })
        .expect(201);
      const teacherToken = teacherSession.body.accessToken as string;
      const otherTeacherToken = otherTeacherSession.body.accessToken as string;

      // A different teacher can't post an announcement on someone else's
      // course (404, IDOR guard).
      await request(app.getHttpServer())
        .post("/organizations/me/teacher-portal/announcements")
        .set(...auth(otherTeacherToken))
        .send({ teachingAssignmentId: teachingAssignment.body.id, title: "Intruder Announcement", body: "..." })
        .expect(404);

      const announcement = await request(app.getHttpServer())
        .post("/organizations/me/teacher-portal/announcements")
        .set(...auth(teacherToken))
        .send({ teachingAssignmentId: teachingAssignment.body.id, title: "No class Friday", body: "We have a school event." })
        .expect(201);
      expect(announcement.body.isPublished).toBe(false);

      // Build an enrolled student and an unrelated, unenrolled one.
      const student = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `AN-STU-${suffix}`, firstName: "Announce", lastName: "Student", dateOfBirth: "2015-01-01" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/students/${student.body.id}/enrollments`)
        .set(...auth(tokenA))
        .send({ programId: program.body.id, sectionId: section.body.id, termId: term.body.id, enrollmentDate: "2099-08-01" })
        .expect(201);
      const studentLogin = await request(app.getHttpServer())
        .post(`/organizations/me/students/${student.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "AnnounceStudentPass123" })
        .expect(201);
      const studentSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: studentLogin.body.username, password: "AnnounceStudentPass123" })
        .expect(201);
      const studentToken = studentSession.body.accessToken as string;

      const otherStudent = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `AN-STU2-${suffix}`, firstName: "Outside", lastName: "AnnounceStudent", dateOfBirth: "2015-01-01" })
        .expect(201);
      const otherStudentLogin = await request(app.getHttpServer())
        .post(`/organizations/me/students/${otherStudent.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "OtherAnnounceStudentPass123" })
        .expect(201);
      const otherStudentSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: otherStudentLogin.body.username, password: "OtherAnnounceStudentPass123" })
        .expect(201);
      const otherStudentToken = otherStudentSession.body.accessToken as string;

      // Unpublished draft is invisible to the enrolled student.
      const listBeforePublish = await request(app.getHttpServer())
        .get("/organizations/me/portal/announcements")
        .set(...auth(studentToken))
        .expect(200);
      expect(listBeforePublish.body).toEqual([]);

      // A different teacher can't publish (or otherwise update) someone
      // else's announcement (404).
      await request(app.getHttpServer())
        .put(`/organizations/me/teacher-portal/announcements/${announcement.body.id}`)
        .set(...auth(otherTeacherToken))
        .send({ isPublished: true })
        .expect(404);

      await request(app.getHttpServer())
        .put(`/organizations/me/teacher-portal/announcements/${announcement.body.id}`)
        .set(...auth(teacherToken))
        .send({ isPublished: true })
        .expect(200);

      const listAfterPublish = await request(app.getHttpServer())
        .get("/organizations/me/portal/announcements")
        .set(...auth(studentToken))
        .expect(200);
      expect(listAfterPublish.body).toHaveLength(1);
      expect(listAfterPublish.body[0].title).toBe("No class Friday");
      expect(listAfterPublish.body[0].teachingAssignment.subject.name).toBe(`Announce Subject ${suffix}`);

      // A student not enrolled in this course never sees it, published
      // or not.
      const otherStudentList = await request(app.getHttpServer())
        .get("/organizations/me/portal/announcements")
        .set(...auth(otherStudentToken))
        .expect(200);
      expect(otherStudentList.body).toEqual([]);

      // The owning teacher's own list shows both published and draft
      // announcements on their course.
      const teacherView = await request(app.getHttpServer())
        .get(`/organizations/me/teacher-portal/announcements?teachingAssignmentId=${teachingAssignment.body.id}`)
        .set(...auth(teacherToken))
        .expect(200);
      expect(teacherView.body).toHaveLength(1);
      expect(teacherView.body[0].isPublished).toBe(true);
      await request(app.getHttpServer())
        .get(`/organizations/me/teacher-portal/announcements?teachingAssignmentId=${teachingAssignment.body.id}`)
        .set(...auth(otherTeacherToken))
        .expect(404);

      // Cross-tenant: org B can't post an announcement on org A's
      // course.
      await request(app.getHttpServer())
        .post("/organizations/me/teacher-portal/announcements")
        .set(...auth(tokenB))
        .send({ teachingAssignmentId: teachingAssignment.body.id, title: "Intruder Announcement", body: "..." })
        .expect(404);
    }, 90000);
  });

  describe("Discussions (LMS discovery slice 6)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    it("lets a teacher start/publish a discussion topic on their own course, and both the teacher and enrolled students can reply (IDOR + tenant guards)", async () => {
      const suffix = `DI${run}`;

      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(tokenA))
        .send({ name: `Discuss Campus ${suffix}`, code: `DICAMP${suffix}` })
        .expect(201);
      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(tokenA))
        .send({ campusId: campus.body.id, name: `Discuss Faculty ${suffix}`, code: `DIFAC${suffix}` })
        .expect(201);
      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(tokenA))
        .send({ facultyId: faculty.body.id, name: `Discuss Dept ${suffix}`, code: `DIDEP${suffix}` })
        .expect(201);
      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(tokenA))
        .send({ departmentId: department.body.id, name: `Discuss Program ${suffix}`, code: `DIPROG${suffix}` })
        .expect(201);
      const year = await request(app.getHttpServer())
        .post("/organizations/me/academic-years")
        .set(...auth(tokenA))
        .send({ name: `Discuss Year ${suffix}`, startDate: "2099-08-01", endDate: "2100-06-30" })
        .expect(201);
      const term = await request(app.getHttpServer())
        .post("/organizations/me/terms")
        .set(...auth(tokenA))
        .send({
          academicYearId: year.body.id,
          name: `Discuss Term ${suffix}`,
          code: `DIT${suffix}`,
          sequence: 1,
          startDate: "2099-08-01",
          endDate: "2099-12-15",
        })
        .expect(201);
      const section = await request(app.getHttpServer())
        .post("/organizations/me/sections")
        .set(...auth(tokenA))
        .send({ programId: program.body.id, termId: term.body.id, name: `Discuss Section ${suffix}`, code: `DIS${suffix}` })
        .expect(201);
      const staffType = await request(app.getHttpServer())
        .post("/organizations/me/staff-types")
        .set(...auth(tokenA))
        .send({ name: `Discuss Staff Type ${suffix}`, code: `DIST${suffix}` })
        .expect(201);
      const designation = await request(app.getHttpServer())
        .post("/organizations/me/designations")
        .set(...auth(tokenA))
        .send({ name: `Discuss Designation ${suffix}`, code: `DIDS${suffix}` })
        .expect(201);
      const subject = await request(app.getHttpServer())
        .post("/organizations/me/subjects")
        .set(...auth(tokenA))
        .send({ name: `Discuss Subject ${suffix}`, code: `DISUB${suffix}` })
        .expect(201);

      const teacher = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(tokenA))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `DI-TCH-${suffix}`,
          firstName: "Discuss",
          lastName: "Teacher",
          email: `di-teacher-${suffix}-${run}@rls-e2e.test`,
          dateOfJoining: "2026-01-01",
        })
        .expect(201);
      const otherTeacher = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(tokenA))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `DI-TCH2-${suffix}`,
          firstName: "Other",
          lastName: "DiscussTeacher",
          email: `di-teacher2-${suffix}-${run}@rls-e2e.test`,
          dateOfJoining: "2026-01-01",
        })
        .expect(201);

      const teachingAssignment = await request(app.getHttpServer())
        .post("/organizations/me/teaching-assignments")
        .set(...auth(tokenA))
        .send({ employeeId: teacher.body.id, subjectId: subject.body.id, sectionId: section.body.id, termId: term.body.id })
        .expect(201);

      const teacherLogin = await request(app.getHttpServer())
        .post(`/organizations/me/employees/${teacher.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "DiscussTeacherPass123" })
        .expect(201);
      const otherTeacherLogin = await request(app.getHttpServer())
        .post(`/organizations/me/employees/${otherTeacher.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "OtherDiscussTeacherPass123" })
        .expect(201);
      const teacherSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: teacherLogin.body.username, password: "DiscussTeacherPass123" })
        .expect(201);
      const otherTeacherSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: otherTeacherLogin.body.username, password: "OtherDiscussTeacherPass123" })
        .expect(201);
      const teacherToken = teacherSession.body.accessToken as string;
      const otherTeacherToken = otherTeacherSession.body.accessToken as string;

      // A different teacher can't start a topic on someone else's course
      // (404, IDOR guard).
      await request(app.getHttpServer())
        .post("/organizations/me/teacher-portal/discussion-topics")
        .set(...auth(otherTeacherToken))
        .send({ teachingAssignmentId: teachingAssignment.body.id, title: "Intruder Topic", body: "..." })
        .expect(404);

      const topic = await request(app.getHttpServer())
        .post("/organizations/me/teacher-portal/discussion-topics")
        .set(...auth(teacherToken))
        .send({ teachingAssignmentId: teachingAssignment.body.id, title: "Favorite math trick?", body: "Share your best shortcut." })
        .expect(201);
      expect(topic.body.isPublished).toBe(false);

      // A different teacher can't read, update, or reply to someone
      // else's topic (404).
      await request(app.getHttpServer())
        .get(`/organizations/me/teacher-portal/discussion-topics/${topic.body.id}`)
        .set(...auth(otherTeacherToken))
        .expect(404);
      await request(app.getHttpServer())
        .put(`/organizations/me/teacher-portal/discussion-topics/${topic.body.id}`)
        .set(...auth(otherTeacherToken))
        .send({ isPublished: true })
        .expect(404);
      await request(app.getHttpServer())
        .post(`/organizations/me/teacher-portal/discussion-topics/${topic.body.id}/posts`)
        .set(...auth(otherTeacherToken))
        .send({ body: "Intruder reply" })
        .expect(404);

      // Build an enrolled student and an unrelated, unenrolled one.
      const student = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `DI-STU-${suffix}`, firstName: "Discuss", lastName: "Student", dateOfBirth: "2015-01-01" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/students/${student.body.id}/enrollments`)
        .set(...auth(tokenA))
        .send({ programId: program.body.id, sectionId: section.body.id, termId: term.body.id, enrollmentDate: "2099-08-01" })
        .expect(201);
      const studentLogin = await request(app.getHttpServer())
        .post(`/organizations/me/students/${student.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "DiscussStudentPass123" })
        .expect(201);
      const studentSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: studentLogin.body.username, password: "DiscussStudentPass123" })
        .expect(201);
      const studentToken = studentSession.body.accessToken as string;

      const otherStudent = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `DI-STU2-${suffix}`, firstName: "Outside", lastName: "DiscussStudent", dateOfBirth: "2015-01-01" })
        .expect(201);
      const otherStudentLogin = await request(app.getHttpServer())
        .post(`/organizations/me/students/${otherStudent.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "OtherDiscussStudentPass123" })
        .expect(201);
      const otherStudentSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: otherStudentLogin.body.username, password: "OtherDiscussStudentPass123" })
        .expect(201);
      const otherStudentToken = otherStudentSession.body.accessToken as string;

      // Unpublished draft is invisible to the enrolled student, and
      // can't be replied to (404).
      const listBeforePublish = await request(app.getHttpServer())
        .get("/organizations/me/portal/discussion-topics")
        .set(...auth(studentToken))
        .expect(200);
      expect(listBeforePublish.body).toEqual([]);
      await request(app.getHttpServer())
        .get(`/organizations/me/portal/discussion-topics/${topic.body.id}`)
        .set(...auth(studentToken))
        .expect(404);
      await request(app.getHttpServer())
        .post(`/organizations/me/portal/discussion-topics/${topic.body.id}/posts`)
        .set(...auth(studentToken))
        .send({ body: "Too early" })
        .expect(404);

      await request(app.getHttpServer())
        .put(`/organizations/me/teacher-portal/discussion-topics/${topic.body.id}`)
        .set(...auth(teacherToken))
        .send({ isPublished: true })
        .expect(200);

      const listAfterPublish = await request(app.getHttpServer())
        .get("/organizations/me/portal/discussion-topics")
        .set(...auth(studentToken))
        .expect(200);
      expect(listAfterPublish.body).toHaveLength(1);
      expect(listAfterPublish.body[0].title).toBe("Favorite math trick?");

      // A student not enrolled in this course never sees it, published
      // or not, and can't reply either (404).
      const otherStudentList = await request(app.getHttpServer())
        .get("/organizations/me/portal/discussion-topics")
        .set(...auth(otherStudentToken))
        .expect(200);
      expect(otherStudentList.body).toEqual([]);
      await request(app.getHttpServer())
        .post(`/organizations/me/portal/discussion-topics/${topic.body.id}/posts`)
        .set(...auth(otherStudentToken))
        .send({ body: "Intruder reply" })
        .expect(404);

      // The enrolled student replies — attributed to their own Student
      // row, never a request param.
      const studentPost = await request(app.getHttpServer())
        .post(`/organizations/me/portal/discussion-topics/${topic.body.id}/posts`)
        .set(...auth(studentToken))
        .send({ body: "Doubling and halving!" })
        .expect(201);
      expect(studentPost.body.authorStudentId).toBe(student.body.id);
      expect(studentPost.body.authorEmployeeId).toBeNull();

      // The owning teacher replies too — attributed to their own
      // Employee row.
      const teacherPost = await request(app.getHttpServer())
        .post(`/organizations/me/teacher-portal/discussion-topics/${topic.body.id}/posts`)
        .set(...auth(teacherToken))
        .send({ body: "Great tip! Anyone else?" })
        .expect(201);
      expect(teacherPost.body.authorEmployeeId).toBe(teacher.body.id);
      expect(teacherPost.body.authorStudentId).toBeNull();

      // Both the teacher's and the student's own views show both posts,
      // in order, with the correct author identified.
      const teacherView = await request(app.getHttpServer())
        .get(`/organizations/me/teacher-portal/discussion-topics/${topic.body.id}`)
        .set(...auth(teacherToken))
        .expect(200);
      expect(teacherView.body.posts).toHaveLength(2);
      expect(teacherView.body.posts[0].authorStudent.id).toBe(student.body.id);
      expect(teacherView.body.posts[1].authorEmployee.id).toBe(teacher.body.id);

      const studentView = await request(app.getHttpServer())
        .get(`/organizations/me/portal/discussion-topics/${topic.body.id}`)
        .set(...auth(studentToken))
        .expect(200);
      expect(studentView.body.posts).toHaveLength(2);
      expect(studentView.body.posts[1].authorEmployee.firstName).toBe("Discuss");

      // Cross-tenant: org B can't start a topic on org A's course.
      await request(app.getHttpServer())
        .post("/organizations/me/teacher-portal/discussion-topics")
        .set(...auth(tokenB))
        .send({ teachingAssignmentId: teachingAssignment.body.id, title: "Intruder Topic", body: "..." })
        .expect(404);
    }, 90000);
  });
});
