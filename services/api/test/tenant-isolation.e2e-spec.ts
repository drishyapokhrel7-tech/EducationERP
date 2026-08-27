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
        // Inventory (Phase 7 slice 7f) — assetAssignment references
        // asset + employee (both RESTRICT), so it must precede both
        // (employee is deleted right below). purchaseOrderItem
        // references purchaseOrder + inventoryItem (RESTRICT), so it
        // leads both; stockMovement references inventoryItem
        // (RESTRICT, purchaseOrderId is ON DELETE SET NULL so no
        // ordering requirement against purchaseOrder specifically).
        // purchaseOrder references supplier (RESTRICT); inventoryItem
        // references inventoryCategory (RESTRICT); asset's categoryId
        // is ON DELETE SET NULL, grouped here for readability anyway.
        "assetAssignment",
        "purchaseOrderItem",
        "stockMovement",
        "purchaseOrder",
        "asset",
        "inventoryItem",
        "supplier",
        "inventoryCategory",
        // Communication (Phase 7 slice 7g) — pushNotificationLog/
        // smsLog/emailLog all reference message (RESTRICT), so all
        // three lead it. message's createdByUserId/recipientUserId
        // FK to users, and templateId to messageTemplate — neither
        // needs an ordering entry here (users are never deleted by
        // this suite at all; templateId is ON DELETE SET NULL).
        "pushNotificationLog",
        "smsLog",
        "emailLog",
        "message",
        "messageTemplate",
        // Documents & Certificates (Phase 7h) — staffDocument
        // references employee (RESTRICT), so it must precede it.
        "staffDocument",
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
        // Hostel (Phase 7 slice 7e) — hostelAttendance/hostelVisitor/
        // hostelComplaint all reference hostelAllocation (RESTRICT), so
        // all three lead it; hostelAllocation itself references
        // studentEnrollment + hostelBed (both RESTRICT), so it must
        // precede both. hostelMaintenanceRequest/hostelBed reference
        // hostelRoom (RESTRICT), hostelRoom references hostelBuilding
        // (RESTRICT), hostelBuilding references hostel (RESTRICT) —
        // the whole chain must finish before studentEnrollment below.
        "hostelAttendance",
        "hostelVisitor",
        "hostelComplaint",
        "hostelAllocation",
        "hostelMaintenanceRequest",
        "hostelBed",
        "hostelRoom",
        "hostelBuilding",
        "hostel",
        // hostelLookup only FKs to organization — no ordering
        // requirement against anything else in this list.
        "hostelLookup",
        // Documents & Certificates (Phase 7h) — studentDocument and
        // certificate both reference student (RESTRICT), so both
        // must precede it. certificate has no RLS (see schema.prisma)
        // but this deleteMany's explicit where:{organizationId}
        // scopes it correctly regardless.
        "studentDocument",
        "certificate",
        // Alumni & Career, part 1 (Phase 8 slice 8a) —
        // alumniCareerHistory references alumniProfile + alumniCompany
        // (both RESTRICT), so it leads both; alumniEducation/
        // alumniSkill/alumniCertification reference alumniProfile
        // only; alumniProfile itself references student (RESTRICT),
        // so the whole chain finishes before studentEnrollment/
        // student below.
        // Alumni engagement (Phase 8 slice 8b) — alumniSurveyResponse
        // references both alumniSurvey and alumniProfile (RESTRICT),
        // so it leads both; alumniMentorship references alumniProfile
        // and student (RESTRICT); alumniAchievement references
        // alumniProfile only.
        "alumniSurveyResponse",
        "alumniSurvey",
        "alumniMentorship",
        "alumniAchievement",
        "alumniCareerHistory",
        "alumniEducation",
        "alumniSkill",
        "alumniCertification",
        "alumniProfile",
        "alumniCompany",
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
        // notification.userId is RESTRICT (LMS discovery slice 9) — must
        // clear before the global user.deleteMany call below runs.
        "notification",
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

  describe("Gradebook (LMS discovery slice 7)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    // The only new backend surface this slice adds is the roster
    // endpoint — the grade grid itself is built client-side from
    // listTeacherAssignments/listTeacherQuizzes, both already covered by
    // slices 3 and 4's own e2e tests. This test only needs to prove the
    // roster endpoint's own ownership/tenant guards and correctness.
    it("returns a teacher's own course roster (enrolled students only), gated to their own course (IDOR + tenant guards)", async () => {
      const suffix = `GB${run}`;

      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(tokenA))
        .send({ name: `Gradebook Campus ${suffix}`, code: `GBCAMP${suffix}` })
        .expect(201);
      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(tokenA))
        .send({ campusId: campus.body.id, name: `Gradebook Faculty ${suffix}`, code: `GBFAC${suffix}` })
        .expect(201);
      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(tokenA))
        .send({ facultyId: faculty.body.id, name: `Gradebook Dept ${suffix}`, code: `GBDEP${suffix}` })
        .expect(201);
      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(tokenA))
        .send({ departmentId: department.body.id, name: `Gradebook Program ${suffix}`, code: `GBPROG${suffix}` })
        .expect(201);
      const year = await request(app.getHttpServer())
        .post("/organizations/me/academic-years")
        .set(...auth(tokenA))
        .send({ name: `Gradebook Year ${suffix}`, startDate: "2099-08-01", endDate: "2100-06-30" })
        .expect(201);
      const term = await request(app.getHttpServer())
        .post("/organizations/me/terms")
        .set(...auth(tokenA))
        .send({
          academicYearId: year.body.id,
          name: `Gradebook Term ${suffix}`,
          code: `GBT${suffix}`,
          sequence: 1,
          startDate: "2099-08-01",
          endDate: "2099-12-15",
        })
        .expect(201);
      const section = await request(app.getHttpServer())
        .post("/organizations/me/sections")
        .set(...auth(tokenA))
        .send({ programId: program.body.id, termId: term.body.id, name: `Gradebook Section ${suffix}`, code: `GBS${suffix}` })
        .expect(201);
      const staffType = await request(app.getHttpServer())
        .post("/organizations/me/staff-types")
        .set(...auth(tokenA))
        .send({ name: `Gradebook Staff Type ${suffix}`, code: `GBST${suffix}` })
        .expect(201);
      const designation = await request(app.getHttpServer())
        .post("/organizations/me/designations")
        .set(...auth(tokenA))
        .send({ name: `Gradebook Designation ${suffix}`, code: `GBDS${suffix}` })
        .expect(201);
      const subject = await request(app.getHttpServer())
        .post("/organizations/me/subjects")
        .set(...auth(tokenA))
        .send({ name: `Gradebook Subject ${suffix}`, code: `GBSUB${suffix}` })
        .expect(201);

      const teacher = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(tokenA))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `GB-TCH-${suffix}`,
          firstName: "Gradebook",
          lastName: "Teacher",
          email: `gb-teacher-${suffix}-${run}@rls-e2e.test`,
          dateOfJoining: "2026-01-01",
        })
        .expect(201);
      const otherTeacher = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(tokenA))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `GB-TCH2-${suffix}`,
          firstName: "Other",
          lastName: "GradebookTeacher",
          email: `gb-teacher2-${suffix}-${run}@rls-e2e.test`,
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
        .send({ password: "GradebookTeacherPass123" })
        .expect(201);
      const otherTeacherLogin = await request(app.getHttpServer())
        .post(`/organizations/me/employees/${otherTeacher.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "OtherGradebookTeacherPass123" })
        .expect(201);
      const teacherSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: teacherLogin.body.username, password: "GradebookTeacherPass123" })
        .expect(201);
      const otherTeacherSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: otherTeacherLogin.body.username, password: "OtherGradebookTeacherPass123" })
        .expect(201);
      const teacherToken = teacherSession.body.accessToken as string;
      const otherTeacherToken = otherTeacherSession.body.accessToken as string;

      // Two enrolled students, one unrelated student never enrolled in
      // this section+term (must never appear in the roster).
      const student1 = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `GB-STU1-${suffix}`, firstName: "Aabha", lastName: "GradebookStudent", dateOfBirth: "2015-01-01" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/students/${student1.body.id}/enrollments`)
        .set(...auth(tokenA))
        .send({ programId: program.body.id, sectionId: section.body.id, termId: term.body.id, enrollmentDate: "2099-08-01" })
        .expect(201);
      const student2 = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `GB-STU2-${suffix}`, firstName: "Zubin", lastName: "GradebookStudent", dateOfBirth: "2015-01-01" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/students/${student2.body.id}/enrollments`)
        .set(...auth(tokenA))
        .send({ programId: program.body.id, sectionId: section.body.id, termId: term.body.id, enrollmentDate: "2099-08-01" })
        .expect(201);
      const outsideStudent = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `GB-STU3-${suffix}`, firstName: "Outside", lastName: "GradebookStudent", dateOfBirth: "2015-01-01" })
        .expect(201);

      // A different teacher can't read the roster of someone else's
      // course (404, IDOR guard).
      await request(app.getHttpServer())
        .get(`/organizations/me/teacher-portal/courses/${teachingAssignment.body.id}/roster`)
        .set(...auth(otherTeacherToken))
        .expect(404);

      const roster = await request(app.getHttpServer())
        .get(`/organizations/me/teacher-portal/courses/${teachingAssignment.body.id}/roster`)
        .set(...auth(teacherToken))
        .expect(200);
      expect(roster.body).toHaveLength(2);
      const rosterIds = roster.body.map((s: { id: string }) => s.id);
      expect(rosterIds).toEqual(expect.arrayContaining([student1.body.id, student2.body.id]));
      expect(rosterIds).not.toContain(outsideStudent.body.id);

      // Cross-tenant: org B can't read org A's course roster.
      await request(app.getHttpServer())
        .get(`/organizations/me/teacher-portal/courses/${teachingAssignment.body.id}/roster`)
        .set(...auth(tokenB))
        .expect(404);
    }, 60000);
  });

  describe("Notifications (LMS discovery slice 9)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    it("notifies enrolled students on publish, the graded student on grading, and discussion participants on a reply — never the actor themselves", async () => {
      const suffix = `NT${run}`;

      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(tokenA))
        .send({ name: `Notify Campus ${suffix}`, code: `NTCAMP${suffix}` })
        .expect(201);
      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(tokenA))
        .send({ campusId: campus.body.id, name: `Notify Faculty ${suffix}`, code: `NTFAC${suffix}` })
        .expect(201);
      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(tokenA))
        .send({ facultyId: faculty.body.id, name: `Notify Dept ${suffix}`, code: `NTDEP${suffix}` })
        .expect(201);
      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(tokenA))
        .send({ departmentId: department.body.id, name: `Notify Program ${suffix}`, code: `NTPROG${suffix}` })
        .expect(201);
      const year = await request(app.getHttpServer())
        .post("/organizations/me/academic-years")
        .set(...auth(tokenA))
        .send({ name: `Notify Year ${suffix}`, startDate: "2099-08-01", endDate: "2100-06-30" })
        .expect(201);
      const term = await request(app.getHttpServer())
        .post("/organizations/me/terms")
        .set(...auth(tokenA))
        .send({
          academicYearId: year.body.id,
          name: `Notify Term ${suffix}`,
          code: `NTT${suffix}`,
          sequence: 1,
          startDate: "2099-08-01",
          endDate: "2099-12-15",
        })
        .expect(201);
      const section = await request(app.getHttpServer())
        .post("/organizations/me/sections")
        .set(...auth(tokenA))
        .send({ programId: program.body.id, termId: term.body.id, name: `Notify Section ${suffix}`, code: `NTS${suffix}` })
        .expect(201);
      const staffType = await request(app.getHttpServer())
        .post("/organizations/me/staff-types")
        .set(...auth(tokenA))
        .send({ name: `Notify Staff Type ${suffix}`, code: `NTST${suffix}` })
        .expect(201);
      const designation = await request(app.getHttpServer())
        .post("/organizations/me/designations")
        .set(...auth(tokenA))
        .send({ name: `Notify Designation ${suffix}`, code: `NTDS${suffix}` })
        .expect(201);
      const subject = await request(app.getHttpServer())
        .post("/organizations/me/subjects")
        .set(...auth(tokenA))
        .send({ name: `Notify Subject ${suffix}`, code: `NTSUB${suffix}` })
        .expect(201);

      const teacher = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(tokenA))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `NT-TCH-${suffix}`,
          firstName: "Notify",
          lastName: "Teacher",
          email: `nt-teacher-${suffix}-${run}@rls-e2e.test`,
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
        .send({ password: "NotifyTeacherPass123" })
        .expect(201);
      const teacherSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: teacherLogin.body.username, password: "NotifyTeacherPass123" })
        .expect(201);
      const teacherToken = teacherSession.body.accessToken as string;

      // Two enrolled students, one unrelated student never enrolled here
      // — the negative control that must never receive any of these
      // notifications.
      const student1 = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `NT-STU1-${suffix}`, firstName: "Notify", lastName: "StudentOne", dateOfBirth: "2015-01-01" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/students/${student1.body.id}/enrollments`)
        .set(...auth(tokenA))
        .send({ programId: program.body.id, sectionId: section.body.id, termId: term.body.id, enrollmentDate: "2099-08-01" })
        .expect(201);
      const student1Login = await request(app.getHttpServer())
        .post(`/organizations/me/students/${student1.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "NotifyStudent1Pass123" })
        .expect(201);
      const student1Session = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: student1Login.body.username, password: "NotifyStudent1Pass123" })
        .expect(201);
      const student1Token = student1Session.body.accessToken as string;

      const student2 = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `NT-STU2-${suffix}`, firstName: "Notify", lastName: "StudentTwo", dateOfBirth: "2015-01-01" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/students/${student2.body.id}/enrollments`)
        .set(...auth(tokenA))
        .send({ programId: program.body.id, sectionId: section.body.id, termId: term.body.id, enrollmentDate: "2099-08-01" })
        .expect(201);
      const student2Login = await request(app.getHttpServer())
        .post(`/organizations/me/students/${student2.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "NotifyStudent2Pass123" })
        .expect(201);
      const student2Session = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: student2Login.body.username, password: "NotifyStudent2Pass123" })
        .expect(201);
      const student2Token = student2Session.body.accessToken as string;

      const outsideStudent = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `NT-STU3-${suffix}`, firstName: "Outside", lastName: "NotifyStudent", dateOfBirth: "2015-01-01" })
        .expect(201);
      const outsideStudentLogin = await request(app.getHttpServer())
        .post(`/organizations/me/students/${outsideStudent.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "OutsideNotifyStudentPass123" })
        .expect(201);
      const outsideStudentSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: outsideStudentLogin.body.username, password: "OutsideNotifyStudentPass123" })
        .expect(201);
      const outsideStudentToken = outsideStudentSession.body.accessToken as string;

      // ── Assignment published → notifies both enrolled students, not
      // the unenrolled outsider.
      const assignment = await request(app.getHttpServer())
        .post("/organizations/me/teacher-portal/assignments")
        .set(...auth(teacherToken))
        .send({ teachingAssignmentId: teachingAssignment.body.id, title: "Notify Essay", submissionType: "TEXT", maxScore: 10 })
        .expect(201);
      await request(app.getHttpServer())
        .put(`/organizations/me/teacher-portal/assignments/${assignment.body.id}`)
        .set(...auth(teacherToken))
        .send({ isPublished: true })
        .expect(200);

      const student1AfterAssignment = await request(app.getHttpServer())
        .get("/organizations/me/notifications")
        .set(...auth(student1Token))
        .expect(200);
      expect(student1AfterAssignment.body.some((n: { type: string }) => n.type === "assignment_published")).toBe(true);
      const student2AfterAssignment = await request(app.getHttpServer())
        .get("/organizations/me/notifications")
        .set(...auth(student2Token))
        .expect(200);
      expect(student2AfterAssignment.body.some((n: { type: string }) => n.type === "assignment_published")).toBe(true);
      const outsideAfterAssignment = await request(app.getHttpServer())
        .get("/organizations/me/notifications")
        .set(...auth(outsideStudentToken))
        .expect(200);
      expect(outsideAfterAssignment.body).toEqual([]);

      // ── Quiz published → notifies enrolled students.
      const quiz = await request(app.getHttpServer())
        .post("/organizations/me/teacher-portal/quizzes")
        .set(...auth(teacherToken))
        .send({ teachingAssignmentId: teachingAssignment.body.id, title: "Notify Quiz" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/teacher-portal/quizzes/${quiz.body.id}/questions`)
        .set(...auth(teacherToken))
        .send({ sequence: 1, text: "1 + 1?", options: ["1", "2"], correctOptionIndex: 1 })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/teacher-portal/quizzes/${quiz.body.id}/publish`)
        .set(...auth(teacherToken))
        .expect(201);

      const student1AfterQuiz = await request(app.getHttpServer())
        .get("/organizations/me/notifications")
        .set(...auth(student1Token))
        .expect(200);
      expect(student1AfterQuiz.body.some((n: { type: string }) => n.type === "quiz_published")).toBe(true);

      // ── Announcement published → notifies enrolled students.
      const announcement = await request(app.getHttpServer())
        .post("/organizations/me/teacher-portal/announcements")
        .set(...auth(teacherToken))
        .send({ teachingAssignmentId: teachingAssignment.body.id, title: "Notify Announcement", body: "..." })
        .expect(201);
      await request(app.getHttpServer())
        .put(`/organizations/me/teacher-portal/announcements/${announcement.body.id}`)
        .set(...auth(teacherToken))
        .send({ isPublished: true })
        .expect(200);

      const student1AfterAnnouncement = await request(app.getHttpServer())
        .get("/organizations/me/notifications")
        .set(...auth(student1Token))
        .expect(200);
      expect(student1AfterAnnouncement.body.some((n: { type: string }) => n.type === "announcement_published")).toBe(true);

      // ── Discussion topic published → notifies enrolled students.
      const topic = await request(app.getHttpServer())
        .post("/organizations/me/teacher-portal/discussion-topics")
        .set(...auth(teacherToken))
        .send({ teachingAssignmentId: teachingAssignment.body.id, title: "Notify Topic", body: "..." })
        .expect(201);
      await request(app.getHttpServer())
        .put(`/organizations/me/teacher-portal/discussion-topics/${topic.body.id}`)
        .set(...auth(teacherToken))
        .send({ isPublished: true })
        .expect(200);

      const student1AfterTopic = await request(app.getHttpServer())
        .get("/organizations/me/notifications")
        .set(...auth(student1Token))
        .expect(200);
      expect(student1AfterTopic.body.some((n: { type: string }) => n.type === "discussion_topic_published")).toBe(true);

      // ── Assignment graded → notifies only the graded student, not the
      // other enrolled student.
      await request(app.getHttpServer())
        .post(`/organizations/me/portal/assignments/${assignment.body.id}/submit`)
        .set(...auth(student1Token))
        .send({ content: "My answer" })
        .expect(201);
      await request(app.getHttpServer())
        .put(`/organizations/me/teacher-portal/assignments/${assignment.body.id}/submissions/${student1.body.id}/grade`)
        .set(...auth(teacherToken))
        .send({ score: 8 })
        .expect(200);

      const student1AfterGrade = await request(app.getHttpServer())
        .get("/organizations/me/notifications")
        .set(...auth(student1Token))
        .expect(200);
      const gradedNotification = student1AfterGrade.body.find((n: { type: string }) => n.type === "assignment_graded");
      expect(gradedNotification).toBeTruthy();
      const student2AfterGrade = await request(app.getHttpServer())
        .get("/organizations/me/notifications")
        .set(...auth(student2Token))
        .expect(200);
      expect(student2AfterGrade.body.some((n: { type: string }) => n.type === "assignment_graded")).toBe(false);

      // ── Discussion reply → notifies the topic's other participants,
      // never the poster themselves.
      await request(app.getHttpServer())
        .post(`/organizations/me/portal/discussion-topics/${topic.body.id}/posts`)
        .set(...auth(student1Token))
        .send({ body: "Interesting topic!" })
        .expect(201);

      // The teacher (topic owner) is notified of student1's reply.
      const teacherAfterReply = await request(app.getHttpServer())
        .get("/organizations/me/notifications")
        .set(...auth(teacherToken))
        .expect(200);
      expect(teacherAfterReply.body.some((n: { type: string }) => n.type === "discussion_reply")).toBe(true);
      // student1 doesn't notify themselves for their own reply.
      const student1AfterOwnReply = await request(app.getHttpServer())
        .get("/organizations/me/notifications")
        .set(...auth(student1Token))
        .expect(200);
      expect(student1AfterOwnReply.body.filter((n: { type: string }) => n.type === "discussion_reply")).toHaveLength(0);

      // The teacher replies back — now student1 (a prior participant) is
      // notified, but the teacher (the actor this time) is not notified
      // of their own reply.
      await request(app.getHttpServer())
        .post(`/organizations/me/teacher-portal/discussion-topics/${topic.body.id}/posts`)
        .set(...auth(teacherToken))
        .send({ body: "Glad you think so!" })
        .expect(201);

      const student1AfterTeacherReply = await request(app.getHttpServer())
        .get("/organizations/me/notifications")
        .set(...auth(student1Token))
        .expect(200);
      expect(student1AfterTeacherReply.body.filter((n: { type: string }) => n.type === "discussion_reply")).toHaveLength(1);
      const teacherAfterOwnReply = await request(app.getHttpServer())
        .get("/organizations/me/notifications")
        .set(...auth(teacherToken))
        .expect(200);
      expect(teacherAfterOwnReply.body.filter((n: { type: string }) => n.type === "discussion_reply")).toHaveLength(1);

      // ── Read/mark-read/mark-all-read, gated to the caller's own
      // notifications (IDOR guard).
      const unreadBefore = student1AfterTeacherReply.body.filter((n: { isRead: boolean }) => !n.isRead);
      expect(unreadBefore.length).toBeGreaterThan(0);
      const targetNotificationId = unreadBefore[0].id;

      // student2 can't mark student1's own notification as read (404).
      await request(app.getHttpServer())
        .post(`/organizations/me/notifications/${targetNotificationId}/read`)
        .set(...auth(student2Token))
        .expect(404);

      await request(app.getHttpServer())
        .post(`/organizations/me/notifications/${targetNotificationId}/read`)
        .set(...auth(student1Token))
        .expect(201);
      const afterMarkOne = await request(app.getHttpServer())
        .get("/organizations/me/notifications")
        .set(...auth(student1Token))
        .expect(200);
      expect(afterMarkOne.body.find((n: { id: string }) => n.id === targetNotificationId).isRead).toBe(true);

      await request(app.getHttpServer())
        .post("/organizations/me/notifications/read-all")
        .set(...auth(student1Token))
        .expect(201);
      const afterMarkAll = await request(app.getHttpServer())
        .get("/organizations/me/notifications")
        .set(...auth(student1Token))
        .expect(200);
      expect(afterMarkAll.body.every((n: { isRead: boolean }) => n.isRead)).toBe(true);

      // ── Cross-tenant: org B's own notifications never include any of
      // org A's.
      const orgANotificationIds = new Set(afterMarkAll.body.map((n: { id: string }) => n.id));
      const orgBNotifications = await request(app.getHttpServer())
        .get("/organizations/me/notifications")
        .set(...auth(tokenB))
        .expect(200);
      expect(orgBNotifications.body.some((n: { id: string }) => orgANotificationIds.has(n.id))).toBe(false);
    }, 90000);
  });

  describe("File storage (LMS discovery slice 8 — configurable backend, link-compatible)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    it("lets any authenticated user upload a file and reuses the resulting url in an existing link field end to end", async () => {
      const suffix = `FS${run}`;

      // Any authenticated user can upload — there's no ownership to
      // check at the upload step itself, only once the resulting url is
      // attached to something else through that thing's own endpoint.
      const uploaded = await request(app.getHttpServer())
        .post("/organizations/me/uploads")
        .set(...auth(tokenA))
        .attach("file", Buffer.from("not a real file, just e2e test bytes"), {
          filename: "notes.txt",
          contentType: "text/plain",
        })
        .expect(201);
      expect(uploaded.body.url).toEqual(expect.stringContaining("/uploads/"));
      expect(uploaded.body.key).toEqual(expect.stringContaining(".txt"));

      // The local driver's own read-back route actually serves it —
      // hit it through the same test server instance via its key
      // (rather than the absolute url in the response, which embeds a
      // PORT that may not match wherever supertest actually bound this
      // particular app instance).
      const fetched = await request(app.getHttpServer()).get(`/uploads/${uploaded.body.key}`).expect(200);
      expect(fetched.text).toBe("not a real file, just e2e test bytes");

      // Rejects an unsupported mimetype (400) and an empty request with
      // no file field at all (400) — never silently accepted.
      await request(app.getHttpServer())
        .post("/organizations/me/uploads")
        .set(...auth(tokenA))
        .attach("file", Buffer.from("#!/bin/sh\necho hi"), { filename: "script.sh", contentType: "application/x-sh" })
        .expect(400);
      await request(app.getHttpServer()).post("/organizations/me/uploads").set(...auth(tokenA)).expect(400);

      // A well-formed-looking but nonexistent local file 404s, and a
      // filename that doesn't match the safe-charset pattern at all
      // (path-traversal-shaped input) 404s too, rather than ever
      // touching the filesystem with it.
      await request(app.getHttpServer())
        .get("/uploads/00000000-0000-0000-0000-000000000000/00000000-0000-0000-0000-000000000000.png")
        .expect(404);
      await request(app.getHttpServer())
        .get("/uploads/00000000-0000-0000-0000-000000000000/not..a-safe-name")
        .expect(404);

      // Wire-through: the uploaded url is just another link, reused as-
      // is by an already-existing, already-ownership-checked endpoint
      // (a course module item) — no new schema, no special-casing.
      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(tokenA))
        .send({ name: `Storage Campus ${suffix}`, code: `FSCAMP${suffix}` })
        .expect(201);
      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(tokenA))
        .send({ campusId: campus.body.id, name: `Storage Faculty ${suffix}`, code: `FSFAC${suffix}` })
        .expect(201);
      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(tokenA))
        .send({ facultyId: faculty.body.id, name: `Storage Dept ${suffix}`, code: `FSDEP${suffix}` })
        .expect(201);
      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(tokenA))
        .send({ departmentId: department.body.id, name: `Storage Program ${suffix}`, code: `FSPROG${suffix}` })
        .expect(201);
      const year = await request(app.getHttpServer())
        .post("/organizations/me/academic-years")
        .set(...auth(tokenA))
        .send({ name: `Storage Year ${suffix}`, startDate: "2099-08-01", endDate: "2100-06-30" })
        .expect(201);
      const term = await request(app.getHttpServer())
        .post("/organizations/me/terms")
        .set(...auth(tokenA))
        .send({
          academicYearId: year.body.id,
          name: `Storage Term ${suffix}`,
          code: `FST${suffix}`,
          sequence: 1,
          startDate: "2099-08-01",
          endDate: "2099-12-15",
        })
        .expect(201);
      const section = await request(app.getHttpServer())
        .post("/organizations/me/sections")
        .set(...auth(tokenA))
        .send({ programId: program.body.id, termId: term.body.id, name: `Storage Section ${suffix}`, code: `FSS${suffix}` })
        .expect(201);
      const staffType = await request(app.getHttpServer())
        .post("/organizations/me/staff-types")
        .set(...auth(tokenA))
        .send({ name: `Storage Staff Type ${suffix}`, code: `FSST${suffix}` })
        .expect(201);
      const designation = await request(app.getHttpServer())
        .post("/organizations/me/designations")
        .set(...auth(tokenA))
        .send({ name: `Storage Designation ${suffix}`, code: `FSDS${suffix}` })
        .expect(201);
      const subject = await request(app.getHttpServer())
        .post("/organizations/me/subjects")
        .set(...auth(tokenA))
        .send({ name: `Storage Subject ${suffix}`, code: `FSSUB${suffix}` })
        .expect(201);
      const teacher = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(tokenA))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `FS-TCH-${suffix}`,
          firstName: "Storage",
          lastName: "Teacher",
          email: `fs-teacher-${suffix}-${run}@rls-e2e.test`,
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
        .send({ password: "StorageTeacherPass123" })
        .expect(201);
      const teacherSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: teacherLogin.body.username, password: "StorageTeacherPass123" })
        .expect(201);
      const teacherToken = teacherSession.body.accessToken as string;

      const moduleRow = await request(app.getHttpServer())
        .post("/organizations/me/teacher-portal/modules")
        .set(...auth(teacherToken))
        .send({ teachingAssignmentId: teachingAssignment.body.id, title: "Storage Module", sequence: 1 })
        .expect(201);
      const item = await request(app.getHttpServer())
        .post(`/organizations/me/teacher-portal/modules/${moduleRow.body.id}/items`)
        .set(...auth(teacherToken))
        .send({ sequence: 1, title: "Uploaded handout", type: "DOCUMENT", content: uploaded.body.url })
        .expect(201);
      expect(item.body.content).toBe(uploaded.body.url);
    }, 60000);
  });

  describe("Hostel (Phase 7 slice 7e)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    async function buildStudentEnrollment(token: string, suffix: string) {
      const campus = await request(app.getHttpServer())
        .post("/organizations/me/campuses")
        .set(...auth(token))
        .send({ name: `Hostel Campus ${suffix}`, code: `HSCAMP${suffix}` })
        .expect(201);
      const faculty = await request(app.getHttpServer())
        .post("/organizations/me/faculties")
        .set(...auth(token))
        .send({ campusId: campus.body.id, name: `Hostel Faculty ${suffix}`, code: `HSFAC${suffix}` })
        .expect(201);
      const department = await request(app.getHttpServer())
        .post("/organizations/me/departments")
        .set(...auth(token))
        .send({ facultyId: faculty.body.id, name: `Hostel Dept ${suffix}`, code: `HSDEP${suffix}` })
        .expect(201);
      const program = await request(app.getHttpServer())
        .post("/organizations/me/programs")
        .set(...auth(token))
        .send({ departmentId: department.body.id, name: `Hostel Program ${suffix}`, code: `HSPROG${suffix}` })
        .expect(201);
      const year = await request(app.getHttpServer())
        .post("/organizations/me/academic-years")
        .set(...auth(token))
        .send({ name: `Hostel Year ${suffix}`, startDate: "2099-01-01", endDate: "2099-12-31" })
        .expect(201);
      const term = await request(app.getHttpServer())
        .post("/organizations/me/terms")
        .set(...auth(token))
        .send({
          academicYearId: year.body.id,
          name: `Hostel Term ${suffix}`,
          code: `HST${suffix}`,
          sequence: 1,
          startDate: "2099-01-01",
          endDate: "2099-06-30",
        })
        .expect(201);
      const section = await request(app.getHttpServer())
        .post("/organizations/me/sections")
        .set(...auth(token))
        .send({ programId: program.body.id, termId: term.body.id, name: `Hostel Section ${suffix}`, code: `HSS${suffix}` })
        .expect(201);
      const student = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(token))
        .send({ studentCode: `HS-STU-${suffix}`, firstName: "Hostel", lastName: suffix, dateOfBirth: "2015-01-01" })
        .expect(201);
      const enrollment = await request(app.getHttpServer())
        .post(`/organizations/me/students/${student.body.id}/enrollments`)
        .set(...auth(token))
        .send({ programId: program.body.id, sectionId: section.body.id, termId: term.body.id, enrollmentDate: "2099-01-01" })
        .expect(201);
      return { enrollmentId: enrollment.body.id as string, studentId: student.body.id as string };
    }

    it("builds hostel/building/room/beds, allocates/reassigns/unassigns a student, tracks attendance/visitors/complaints/maintenance, and stays tenant-scoped", async () => {
      const suffix = `HS${run}`;

      const hostel = await request(app.getHttpServer())
        .post("/organizations/me/hostels")
        .set(...auth(tokenA))
        .send({ name: `Hostel ${suffix}`, code: `HOSTEL${suffix}` })
        .expect(201);
      const building = await request(app.getHttpServer())
        .post("/organizations/me/hostel-buildings")
        .set(...auth(tokenA))
        .send({ hostelId: hostel.body.id, name: `Building A ${suffix}`, code: `BLDG${suffix}` })
        .expect(201);
      const room = await request(app.getHttpServer())
        .post("/organizations/me/hostel-rooms")
        .set(...auth(tokenA))
        .send({ buildingId: building.body.id, roomNumber: "101", roomType: "Standard" })
        .expect(201);
      const bed1 = await request(app.getHttpServer())
        .post("/organizations/me/hostel-beds")
        .set(...auth(tokenA))
        .send({ roomId: room.body.id, label: "A" })
        .expect(201);
      const bed2 = await request(app.getHttpServer())
        .post("/organizations/me/hostel-beds")
        .set(...auth(tokenA))
        .send({ roomId: room.body.id, label: "B" })
        .expect(201);
      const bed3 = await request(app.getHttpServer())
        .post("/organizations/me/hostel-beds")
        .set(...auth(tokenA))
        .send({ roomId: room.body.id, label: "C" })
        .expect(201);

      const vacantBeforeAllocation = await request(app.getHttpServer())
        .get("/organizations/me/hostel-beds/vacant")
        .set(...auth(tokenA))
        .expect(200);
      expect(vacantBeforeAllocation.body.map((b: { id: string }) => b.id)).toEqual(
        expect.arrayContaining([bed1.body.id, bed2.body.id, bed3.body.id]),
      );

      const { enrollmentId, studentId } = await buildStudentEnrollment(tokenA, suffix);
      const { enrollmentId: otherEnrollmentId } = await buildStudentEnrollment(tokenA, `${suffix}B`);

      const allocation = await request(app.getHttpServer())
        .post("/organizations/me/hostel-allocations")
        .set(...auth(tokenA))
        .send({ studentEnrollmentId: enrollmentId, bedId: bed1.body.id })
        .expect(201);
      expect(allocation.body.bed.id).toBe(bed1.body.id);

      // A different student can't take an already-occupied bed (409).
      await request(app.getHttpServer())
        .post("/organizations/me/hostel-allocations")
        .set(...auth(tokenA))
        .send({ studentEnrollmentId: otherEnrollmentId, bedId: bed1.body.id })
        .expect(409);

      // A bed under maintenance can't be allocated (409).
      await request(app.getHttpServer())
        .patch(`/organizations/me/hostel-beds/${bed2.body.id}`)
        .set(...auth(tokenA))
        .send({ status: "MAINTENANCE" })
        .expect(200);
      await request(app.getHttpServer())
        .post("/organizations/me/hostel-allocations")
        .set(...auth(tokenA))
        .send({ studentEnrollmentId: otherEnrollmentId, bedId: bed2.body.id })
        .expect(409);

      // Reassigning the first student to a different bed updates the
      // same allocation row (current-pointer precedent) and frees the
      // old bed.
      const reassigned = await request(app.getHttpServer())
        .post("/organizations/me/hostel-allocations")
        .set(...auth(tokenA))
        .send({ studentEnrollmentId: enrollmentId, bedId: bed3.body.id })
        .expect(201);
      expect(reassigned.body.id).toBe(allocation.body.id);
      expect(reassigned.body.bed.id).toBe(bed3.body.id);

      const vacantAfterReassign = await request(app.getHttpServer())
        .get("/organizations/me/hostel-beds/vacant")
        .set(...auth(tokenA))
        .expect(200);
      expect(vacantAfterReassign.body.map((b: { id: string }) => b.id)).toContain(bed1.body.id);
      expect(vacantAfterReassign.body.map((b: { id: string }) => b.id)).not.toContain(bed3.body.id);

      // ── Attendance — upsert on (allocation, date).
      const attendanceDate = "2099-02-01";
      await request(app.getHttpServer())
        .post(`/organizations/me/hostel-allocations/${allocation.body.id}/attendance`)
        .set(...auth(tokenA))
        .send({ date: attendanceDate, status: "PRESENT" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/hostel-allocations/${allocation.body.id}/attendance`)
        .set(...auth(tokenA))
        .send({ date: attendanceDate, status: "ABSENT" })
        .expect(201);
      const attendanceList = await request(app.getHttpServer())
        .get(`/organizations/me/hostel-allocations/${allocation.body.id}/attendance`)
        .set(...auth(tokenA))
        .expect(200);
      expect(attendanceList.body).toHaveLength(1);
      expect(attendanceList.body[0].status).toBe("ABSENT");

      // ── Visitors — log in, then check out.
      const visitor = await request(app.getHttpServer())
        .post(`/organizations/me/hostel-allocations/${allocation.body.id}/visitors`)
        .set(...auth(tokenA))
        .send({ visitorName: "Hostel Visitor", relation: "Parent" })
        .expect(201);
      expect(visitor.body.checkOutAt).toBeNull();
      const checkedOut = await request(app.getHttpServer())
        .patch(`/organizations/me/hostel-visitors/${visitor.body.id}/checkout`)
        .set(...auth(tokenA))
        .expect(200);
      expect(checkedOut.body.checkOutAt).not.toBeNull();

      // ── Complaints — OPEN → IN_PROGRESS → RESOLVED.
      const complaint = await request(app.getHttpServer())
        .post(`/organizations/me/hostel-allocations/${allocation.body.id}/complaints`)
        .set(...auth(tokenA))
        .send({ category: "Maintenance", description: "Leaking tap" })
        .expect(201);
      expect(complaint.body.status).toBe("OPEN");
      await request(app.getHttpServer())
        .patch(`/organizations/me/hostel-complaints/${complaint.body.id}`)
        .set(...auth(tokenA))
        .send({ status: "IN_PROGRESS" })
        .expect(200);
      const resolvedComplaint = await request(app.getHttpServer())
        .patch(`/organizations/me/hostel-complaints/${complaint.body.id}`)
        .set(...auth(tokenA))
        .send({ status: "RESOLVED", resolutionNotes: "Fixed by plumber" })
        .expect(200);
      expect(resolvedComplaint.body.resolvedAt).not.toBeNull();
      expect(resolvedComplaint.body.resolutionNotes).toBe("Fixed by plumber");

      // ── Maintenance requests — room-level, not allocation-level.
      const maintenanceRequest = await request(app.getHttpServer())
        .post("/organizations/me/hostel-maintenance")
        .set(...auth(tokenA))
        .send({ roomId: room.body.id, description: "Broken window" })
        .expect(201);
      expect(maintenanceRequest.body.status).toBe("OPEN");
      const resolvedMaintenance = await request(app.getHttpServer())
        .patch(`/organizations/me/hostel-maintenance/${maintenanceRequest.body.id}`)
        .set(...auth(tokenA))
        .send({ status: "RESOLVED" })
        .expect(200);
      expect(resolvedMaintenance.body.resolvedAt).not.toBeNull();

      // ── Unassign — frees the bed, removes the allocation.
      await request(app.getHttpServer())
        .delete(`/organizations/me/hostel-allocations/${enrollmentId}`)
        .set(...auth(tokenA))
        .expect(200);
      const allocationsAfterUnassign = await request(app.getHttpServer())
        .get("/organizations/me/hostel-allocations")
        .set(...auth(tokenA))
        .expect(200);
      expect(allocationsAfterUnassign.body.some((a: { studentEnrollmentId: string }) => a.studentEnrollmentId === enrollmentId)).toBe(
        false,
      );
      const vacantAfterUnassign = await request(app.getHttpServer())
        .get("/organizations/me/hostel-beds/vacant")
        .set(...auth(tokenA))
        .expect(200);
      expect(vacantAfterUnassign.body.map((b: { id: string }) => b.id)).toContain(bed3.body.id);

      // Unassigning again 404s — nothing to unassign.
      await request(app.getHttpServer())
        .delete(`/organizations/me/hostel-allocations/${enrollmentId}`)
        .set(...auth(tokenA))
        .expect(404);

      // ── Cross-tenant: org B can't create a building/room/bed under
      // org A's hostel/building/room, and org B's own hostel list never
      // includes org A's hostel.
      await request(app.getHttpServer())
        .post("/organizations/me/hostel-buildings")
        .set(...auth(tokenB))
        .send({ hostelId: hostel.body.id, name: "Intruder Building", code: `INTRUDE${suffix}` })
        .expect(404);
      const orgBHostels = await request(app.getHttpServer())
        .get("/organizations/me/hostels")
        .set(...auth(tokenB))
        .expect(200);
      expect(orgBHostels.body.some((h: { id: string }) => h.id === hostel.body.id)).toBe(false);

      // Keep studentId referenced so the fixture-building helper's
      // return value isn't flagged unused by a future refactor.
      expect(typeof studentId).toBe("string");
    }, 90000);

    it("standardization lookups (room type / visitor relation / complaint category) upsert by name and stay tenant-scoped", async () => {
      const suffix = `HSLK${run}`;

      const created = await request(app.getHttpServer())
        .post("/organizations/me/hostel-lookups")
        .set(...auth(tokenA))
        .send({ kind: "ROOM_TYPE", name: `Deluxe ${suffix}` })
        .expect(201);

      // Re-adding the exact same (kind, name) upserts to the same row,
      // not a 409 or a duplicate — safe for two staff both typing the
      // same new value before either sees the other's addition.
      const reCreated = await request(app.getHttpServer())
        .post("/organizations/me/hostel-lookups")
        .set(...auth(tokenA))
        .send({ kind: "ROOM_TYPE", name: `Deluxe ${suffix}` })
        .expect(201);
      expect(reCreated.body.id).toBe(created.body.id);

      await request(app.getHttpServer())
        .post("/organizations/me/hostel-lookups")
        .set(...auth(tokenA))
        .send({ kind: "VISITOR_RELATION", name: `Guardian ${suffix}` })
        .expect(201);
      await request(app.getHttpServer())
        .post("/organizations/me/hostel-lookups")
        .set(...auth(tokenA))
        .send({ kind: "COMPLAINT_CATEGORY", name: `Plumbing ${suffix}` })
        .expect(201);

      const roomTypeList = await request(app.getHttpServer())
        .get("/organizations/me/hostel-lookups")
        .query({ kind: "ROOM_TYPE" })
        .set(...auth(tokenA))
        .expect(200);
      expect(roomTypeList.body.every((l: { kind: string }) => l.kind === "ROOM_TYPE")).toBe(true);
      expect(roomTypeList.body.some((l: { name: string }) => l.name === `Deluxe ${suffix}`)).toBe(true);
      expect(roomTypeList.body.some((l: { name: string }) => l.name === `Guardian ${suffix}`)).toBe(false);

      // Cross-tenant: org B never sees org A's lookup catalog.
      const orgBRoomTypes = await request(app.getHttpServer())
        .get("/organizations/me/hostel-lookups")
        .query({ kind: "ROOM_TYPE" })
        .set(...auth(tokenB))
        .expect(200);
      expect(orgBRoomTypes.body.some((l: { name: string }) => l.name === `Deluxe ${suffix}`)).toBe(false);
    }, 30000);
  });

  describe("Inventory (Phase 7 slice 7f)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    async function buildEmployee(token: string, suffix: string) {
      const staffType = await request(app.getHttpServer())
        .post("/organizations/me/staff-types")
        .set(...auth(token))
        .send({ name: `Inventory Staff ${suffix}`, code: `INVST${suffix}` })
        .expect(201);
      const designation = await request(app.getHttpServer())
        .post("/organizations/me/designations")
        .set(...auth(token))
        .send({ name: `Inventory Clerk ${suffix}`, code: `INVCL${suffix}` })
        .expect(201);
      const employee = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(token))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `INV-EMP-${suffix}`,
          firstName: "Inventory",
          lastName: suffix,
          email: `inventory-${suffix}@staff-e2e.test`,
          dateOfJoining: "2026-01-01",
        })
        .expect(201);
      return employee.body.id as string;
    }

    it("tracks categories/suppliers/items/purchase orders/stock movements/assets end to end, and stays tenant-scoped", async () => {
      const suffix = `INV${run}`;

      const category = await request(app.getHttpServer())
        .post("/organizations/me/inventory-categories")
        .set(...auth(tokenA))
        .send({ name: `Stationery ${suffix}`, code: `STAT${suffix}` })
        .expect(201);
      const supplier = await request(app.getHttpServer())
        .post("/organizations/me/suppliers")
        .set(...auth(tokenA))
        .send({ name: `Supplier ${suffix}` })
        .expect(201);
      const item = await request(app.getHttpServer())
        .post("/organizations/me/inventory-items")
        .set(...auth(tokenA))
        .send({ categoryId: category.body.id, name: `Notebook ${suffix}`, sku: `NB-${suffix}`, unit: "piece", reorderLevel: 10 })
        .expect(201);

      const itemsBeforeStock = await request(app.getHttpServer())
        .get("/organizations/me/inventory-items")
        .set(...auth(tokenA))
        .expect(200);
      expect(itemsBeforeStock.body.find((i: { id: string }) => i.id === item.body.id).currentStock).toBe(0);

      // ── Purchase order lifecycle: DRAFT → add lines → ORDERED →
      // receive (partial, then full) → RECEIVED.
      const po = await request(app.getHttpServer())
        .post("/organizations/me/purchase-orders")
        .set(...auth(tokenA))
        .send({ supplierId: supplier.body.id })
        .expect(201);
      expect(po.body.status).toBe("DRAFT");

      const poItem = await request(app.getHttpServer())
        .post(`/organizations/me/purchase-orders/${po.body.id}/items`)
        .set(...auth(tokenA))
        .send({ itemId: item.body.id, quantityOrdered: 50, unitPrice: 25.5 })
        .expect(201);

      // Receiving before the order is even ORDERED is rejected.
      await request(app.getHttpServer())
        .post(`/organizations/me/purchase-orders/${po.body.id}/receive`)
        .set(...auth(tokenA))
        .send({ lines: [{ purchaseOrderItemId: poItem.body.id, quantity: 1 }] })
        .expect(409);

      await request(app.getHttpServer())
        .post(`/organizations/me/purchase-orders/${po.body.id}/place`)
        .set(...auth(tokenA))
        .expect(201);

      // Items can no longer be added once placed.
      await request(app.getHttpServer())
        .post(`/organizations/me/purchase-orders/${po.body.id}/items`)
        .set(...auth(tokenA))
        .send({ itemId: item.body.id, quantityOrdered: 5, unitPrice: 25.5 })
        .expect(409);

      // Partial receipt — order stays ORDERED, stock reflects the
      // partial quantity.
      const partialReceive = await request(app.getHttpServer())
        .post(`/organizations/me/purchase-orders/${po.body.id}/receive`)
        .set(...auth(tokenA))
        .send({ lines: [{ purchaseOrderItemId: poItem.body.id, quantity: 20 }] })
        .expect(201);
      expect(partialReceive.body.status).toBe("ORDERED");

      const itemsAfterPartial = await request(app.getHttpServer())
        .get("/organizations/me/inventory-items")
        .set(...auth(tokenA))
        .expect(200);
      expect(itemsAfterPartial.body.find((i: { id: string }) => i.id === item.body.id).currentStock).toBe(20);

      // Over-receiving beyond what was ordered is rejected.
      await request(app.getHttpServer())
        .post(`/organizations/me/purchase-orders/${po.body.id}/receive`)
        .set(...auth(tokenA))
        .send({ lines: [{ purchaseOrderItemId: poItem.body.id, quantity: 31 }] })
        .expect(409);

      // Receiving the remainder completes the order.
      const fullReceive = await request(app.getHttpServer())
        .post(`/organizations/me/purchase-orders/${po.body.id}/receive`)
        .set(...auth(tokenA))
        .send({ lines: [{ purchaseOrderItemId: poItem.body.id, quantity: 30 }] })
        .expect(201);
      expect(fullReceive.body.status).toBe("RECEIVED");

      const itemsAfterFull = await request(app.getHttpServer())
        .get("/organizations/me/inventory-items")
        .set(...auth(tokenA))
        .expect(200);
      expect(itemsAfterFull.body.find((i: { id: string }) => i.id === item.body.id).currentStock).toBe(50);

      // A fully received order can't receive more or be cancelled.
      await request(app.getHttpServer())
        .post(`/organizations/me/purchase-orders/${po.body.id}/receive`)
        .set(...auth(tokenA))
        .send({ lines: [{ purchaseOrderItemId: poItem.body.id, quantity: 1 }] })
        .expect(409);
      await request(app.getHttpServer())
        .post(`/organizations/me/purchase-orders/${po.body.id}/cancel`)
        .set(...auth(tokenA))
        .expect(409);

      // A separate DRAFT order can be cancelled freely.
      const secondPo = await request(app.getHttpServer())
        .post("/organizations/me/purchase-orders")
        .set(...auth(tokenA))
        .send({ supplierId: supplier.body.id })
        .expect(201);
      const cancelled = await request(app.getHttpServer())
        .post(`/organizations/me/purchase-orders/${secondPo.body.id}/cancel`)
        .set(...auth(tokenA))
        .expect(201);
      expect(cancelled.body.status).toBe("CANCELLED");

      // ── Manual stock adjustment (signed) — a damage write-off.
      await request(app.getHttpServer())
        .post("/organizations/me/stock-movements")
        .set(...auth(tokenA))
        .send({ itemId: item.body.id, quantity: -5, reason: "Damaged in storage" })
        .expect(201);
      const itemsAfterAdjustment = await request(app.getHttpServer())
        .get("/organizations/me/inventory-items")
        .set(...auth(tokenA))
        .expect(200);
      expect(itemsAfterAdjustment.body.find((i: { id: string }) => i.id === item.body.id).currentStock).toBe(45);

      const movements = await request(app.getHttpServer())
        .get("/organizations/me/stock-movements")
        .query({ itemId: item.body.id })
        .set(...auth(tokenA))
        .expect(200);
      expect(movements.body.every((m: { itemId: string }) => m.itemId === item.body.id)).toBe(true);
      expect(movements.body.length).toBe(3); // two receipts + one adjustment

      // ── Assets: create, assign, reject double-assign, return, reassign.
      const employeeId = await buildEmployee(tokenA, suffix);
      const employee2Id = await buildEmployee(tokenA, `${suffix}B`);
      const asset = await request(app.getHttpServer())
        .post("/organizations/me/assets")
        .set(...auth(tokenA))
        .send({ assetTag: `LAPTOP-${suffix}`, name: `Laptop ${suffix}`, categoryId: category.body.id })
        .expect(201);

      const assignment = await request(app.getHttpServer())
        .post("/organizations/me/asset-assignments")
        .set(...auth(tokenA))
        .send({ assetId: asset.body.id, employeeId })
        .expect(201);
      expect(assignment.body.assignedToEmployee.id).toBe(employeeId);

      // Already assigned — a second assignment is rejected.
      await request(app.getHttpServer())
        .post("/organizations/me/asset-assignments")
        .set(...auth(tokenA))
        .send({ assetId: asset.body.id, employeeId: employee2Id })
        .expect(409);

      // An asset under maintenance can't be assigned.
      const asset2 = await request(app.getHttpServer())
        .post("/organizations/me/assets")
        .set(...auth(tokenA))
        .send({ assetTag: `PROJ-${suffix}`, name: `Projector ${suffix}` })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/organizations/me/assets/${asset2.body.id}`)
        .set(...auth(tokenA))
        .send({ status: "MAINTENANCE" })
        .expect(200);
      await request(app.getHttpServer())
        .post("/organizations/me/asset-assignments")
        .set(...auth(tokenA))
        .send({ assetId: asset2.body.id, employeeId })
        .expect(409);

      // Return, then reassign to a different employee.
      await request(app.getHttpServer())
        .post(`/organizations/me/asset-assignments/${assignment.body.id}/return`)
        .set(...auth(tokenA))
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/asset-assignments/${assignment.body.id}/return`)
        .set(...auth(tokenA))
        .expect(409);
      const reassignment = await request(app.getHttpServer())
        .post("/organizations/me/asset-assignments")
        .set(...auth(tokenA))
        .send({ assetId: asset.body.id, employeeId: employee2Id })
        .expect(201);
      expect(reassignment.body.assignedToEmployee.id).toBe(employee2Id);

      const assetsList = await request(app.getHttpServer())
        .get("/organizations/me/assets")
        .set(...auth(tokenA))
        .expect(200);
      const listedAsset = assetsList.body.find((a: { id: string }) => a.id === asset.body.id);
      expect(listedAsset.assignments).toHaveLength(1);
      expect(listedAsset.assignments[0].assignedToEmployee.id).toBe(employee2Id);

      // ── Cross-tenant isolation.
      await request(app.getHttpServer())
        .post("/organizations/me/inventory-items")
        .set(...auth(tokenB))
        .send({ categoryId: category.body.id, name: "Intruder Item", sku: `INTRUDE-${suffix}`, unit: "piece" })
        .expect(404);
      const orgBSuppliers = await request(app.getHttpServer())
        .get("/organizations/me/suppliers")
        .set(...auth(tokenB))
        .expect(200);
      expect(orgBSuppliers.body.some((s: { id: string }) => s.id === supplier.body.id)).toBe(false);
      const orgBAssets = await request(app.getHttpServer())
        .get("/organizations/me/assets")
        .set(...auth(tokenB))
        .expect(200);
      expect(orgBAssets.body.some((a: { id: string }) => a.id === asset.body.id)).toBe(false);
    }, 90000);
  });

  describe("Communication (Phase 7 slice 7g)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    async function buildEmployeeWithLogin(token: string, suffix: string, password: string) {
      const staffType = await request(app.getHttpServer())
        .post("/organizations/me/staff-types")
        .set(...auth(token))
        .send({ name: `Comms Staff ${suffix}`, code: `COMST${suffix}` })
        .expect(201);
      const designation = await request(app.getHttpServer())
        .post("/organizations/me/designations")
        .set(...auth(token))
        .send({ name: `Comms Clerk ${suffix}`, code: `COMCL${suffix}` })
        .expect(201);
      const employee = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(token))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `COM-EMP-${suffix}`,
          firstName: "Comms",
          lastName: suffix,
          email: `comms-${suffix}@staff-e2e.test`,
          phone: "9800000000",
          dateOfJoining: "2026-01-01",
        })
        .expect(201);
      const login = await request(app.getHttpServer())
        .post(`/organizations/me/employees/${employee.body.id}/create-login`)
        .set(...auth(token))
        .send({ password })
        .expect(201);
      return { employeeId: employee.body.id as string, userId: login.body.id as string, username: login.body.username as string };
    }

    it("templates, composes/sends messages across audiences and channels, rejects unresolvable contact combinations, and stays tenant-scoped", async () => {
      const suffix = `COM${run}`;

      const template = await request(app.getHttpServer())
        .post("/organizations/me/message-templates")
        .set(...auth(tokenA))
        .send({ name: `Welcome ${suffix}`, channel: "EMAIL", subject: "Welcome", body: "Welcome to the term!" })
        .expect(201);

      const { userId, username } = await buildEmployeeWithLogin(tokenA, suffix, "CommsPass123");

      // ── Compose from a template — subject/body copied in, not
      // live-referenced.
      const fromTemplate = await request(app.getHttpServer())
        .post("/organizations/me/messages")
        .set(...auth(tokenA))
        .send({ channel: "EMAIL", audience: "ALL_STAFF", templateId: template.body.id })
        .expect(201);
      expect(fromTemplate.body.subject).toBe("Welcome");
      expect(fromTemplate.body.body).toBe("Welcome to the term!");
      expect(fromTemplate.body.status).toBe("DRAFT");

      // A template built for a different channel can't be used.
      await request(app.getHttpServer())
        .post("/organizations/me/messages")
        .set(...auth(tokenA))
        .send({ channel: "SMS", audience: "ALL_STAFF", templateId: template.body.id })
        .expect(400);

      // Neither a body nor a template resolves to content.
      await request(app.getHttpServer())
        .post("/organizations/me/messages")
        .set(...auth(tokenA))
        .send({ channel: "EMAIL", audience: "ALL_STAFF" })
        .expect(400);

      // ── Send to ALL_STAFF over EMAIL — the employee built above has
      // a real email, so at least one EmailLog row should land.
      const sent = await request(app.getHttpServer())
        .post(`/organizations/me/messages/${fromTemplate.body.id}/send`)
        .set(...auth(tokenA))
        .expect(201);
      expect(sent.body.status).toBe("SENT");
      expect(sent.body.sentAt).not.toBeNull();
      expect(sent.body.emailLogs.length).toBeGreaterThan(0);
      expect(sent.body.emailLogs.every((l: { status: string }) => l.status === "SENT")).toBe(true);

      // Sending an already-SENT message is rejected.
      await request(app.getHttpServer())
        .post(`/organizations/me/messages/${fromTemplate.body.id}/send`)
        .set(...auth(tokenA))
        .expect(409);

      // ── SPECIFIC_USER audience.
      await request(app.getHttpServer())
        .post("/organizations/me/messages")
        .set(...auth(tokenA))
        .send({ channel: "EMAIL", audience: "SPECIFIC_USER", body: "Direct note" })
        .expect(400); // recipientUserId required

      const direct = await request(app.getHttpServer())
        .post("/organizations/me/messages")
        .set(...auth(tokenA))
        .send({ channel: "EMAIL", audience: "SPECIFIC_USER", recipientUserId: userId, body: "Direct note" })
        .expect(201);
      const directSent = await request(app.getHttpServer())
        .post(`/organizations/me/messages/${direct.body.id}/send`)
        .set(...auth(tokenA))
        .expect(201);
      expect(directSent.body.emailLogs).toHaveLength(1);
      expect(directSent.body.emailLogs[0].recipientEmail).toBe(`comms-${suffix}@staff-e2e.test`);

      // SMS to a specific user has no phone field to resolve from — rejected at send time.
      const directSms = await request(app.getHttpServer())
        .post("/organizations/me/messages")
        .set(...auth(tokenA))
        .send({ channel: "SMS", audience: "SPECIFIC_USER", recipientUserId: userId, body: "Direct SMS" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/messages/${directSms.body.id}/send`)
        .set(...auth(tokenA))
        .expect(400);

      // ── Unresolvable (audience, channel) combinations — rejected at
      // send time with a clear 400, not a silent no-op.
      const smsToStudents = await request(app.getHttpServer())
        .post("/organizations/me/messages")
        .set(...auth(tokenA))
        .send({ channel: "SMS", audience: "ALL_STUDENTS", body: "x" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/messages/${smsToStudents.body.id}/send`)
        .set(...auth(tokenA))
        .expect(400);

      const pushToGuardians = await request(app.getHttpServer())
        .post("/organizations/me/messages")
        .set(...auth(tokenA))
        .send({ channel: "PUSH", audience: "ALL_GUARDIANS", body: "x" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/messages/${pushToGuardians.body.id}/send`)
        .set(...auth(tokenA))
        .expect(400);

      // ── IN_APP channel reuses the existing Notification table —
      // confirm the employee actually sees it via their own login.
      const inApp = await request(app.getHttpServer())
        .post("/organizations/me/messages")
        .set(...auth(tokenA))
        .send({ channel: "IN_APP", audience: "SPECIFIC_USER", recipientUserId: userId, subject: "Reminder", body: "Don't forget the meeting" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/messages/${inApp.body.id}/send`)
        .set(...auth(tokenA))
        .expect(201);

      const employeeSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: username, password: "CommsPass123" })
        .expect(201);
      const ownNotifications = await request(app.getHttpServer())
        .get("/organizations/me/notifications")
        .set(...auth(employeeSession.body.accessToken))
        .expect(200);
      expect(
        ownNotifications.body.some((n: { title: string; body: string }) => n.title === "Reminder" && n.body === "Don't forget the meeting"),
      ).toBe(true);

      // ── Cross-tenant isolation.
      await request(app.getHttpServer())
        .post("/organizations/me/messages")
        .set(...auth(tokenB))
        .send({ channel: "EMAIL", audience: "SPECIFIC_USER", recipientUserId: userId, body: "Intruder" })
        .expect(404);
      const orgBTemplates = await request(app.getHttpServer())
        .get("/organizations/me/message-templates")
        .set(...auth(tokenB))
        .expect(200);
      expect(orgBTemplates.body.some((t: { id: string }) => t.id === template.body.id)).toBe(false);
      const orgBMessages = await request(app.getHttpServer())
        .get("/organizations/me/messages")
        .set(...auth(tokenB))
        .expect(200);
      expect(orgBMessages.body.some((m: { id: string }) => m.id === fromTemplate.body.id)).toBe(false);
    }, 90000);
  });

  describe("Documents & Certificates (Phase 7h)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    async function buildEmployee(token: string, suffix: string) {
      const staffType = await request(app.getHttpServer())
        .post("/organizations/me/staff-types")
        .set(...auth(token))
        .send({ name: `Docs Staff ${suffix}`, code: `DOCST${suffix}` })
        .expect(201);
      const designation = await request(app.getHttpServer())
        .post("/organizations/me/designations")
        .set(...auth(token))
        .send({ name: `Docs Clerk ${suffix}`, code: `DOCCL${suffix}` })
        .expect(201);
      const employee = await request(app.getHttpServer())
        .post("/organizations/me/employees")
        .set(...auth(token))
        .send({
          staffTypeId: staffType.body.id,
          designationId: designation.body.id,
          employeeCode: `DOC-EMP-${suffix}`,
          firstName: "Docs",
          lastName: suffix,
          email: `docs-${suffix}@staff-e2e.test`,
          dateOfJoining: "2026-01-01",
        })
        .expect(201);
      return employee.body.id as string;
    }

    it("uploads/reviews student and staff documents, issues/verifies/revokes certificates via the public no-auth endpoint, supports student self-service, and stays tenant-scoped", async () => {
      const suffix = `DOC${run}`;

      const student = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `DOC-STU-${suffix}`, firstName: "Rita", lastName: suffix, dateOfBirth: "2015-01-01" })
        .expect(201);
      const employeeId = await buildEmployee(tokenA, suffix);

      // ── Student documents: upload → review (VERIFIED / REJECTED).
      const studentDoc = await request(app.getHttpServer())
        .post("/organizations/me/student-documents")
        .set(...auth(tokenA))
        .send({ studentId: student.body.id, documentType: "Birth Certificate", fileUrl: "https://example.com/birth-cert.pdf" })
        .expect(201);
      expect(studentDoc.body.status).toBe("PENDING");

      const verifiedDoc = await request(app.getHttpServer())
        .patch(`/organizations/me/student-documents/${studentDoc.body.id}/review`)
        .set(...auth(tokenA))
        .send({ status: "VERIFIED", reviewNotes: "Looks good" })
        .expect(200);
      expect(verifiedDoc.body.status).toBe("VERIFIED");
      expect(verifiedDoc.body.reviewedAt).not.toBeNull();
      expect(verifiedDoc.body.reviewedByUserId).toBeTruthy();

      const rejectableDoc = await request(app.getHttpServer())
        .post("/organizations/me/student-documents")
        .set(...auth(tokenA))
        .send({ studentId: student.body.id, documentType: "Photo", fileUrl: "https://example.com/photo.jpg" })
        .expect(201);
      const rejectedDoc = await request(app.getHttpServer())
        .patch(`/organizations/me/student-documents/${rejectableDoc.body.id}/review`)
        .set(...auth(tokenA))
        .send({ status: "REJECTED", reviewNotes: "Blurry" })
        .expect(200);
      expect(rejectedDoc.body.status).toBe("REJECTED");

      const studentDocs = await request(app.getHttpServer())
        .get("/organizations/me/student-documents")
        .query({ studentId: student.body.id })
        .set(...auth(tokenA))
        .expect(200);
      expect(studentDocs.body).toHaveLength(2);

      // ── Staff documents: same shape, briefer.
      const staffDoc = await request(app.getHttpServer())
        .post("/organizations/me/staff-documents")
        .set(...auth(tokenA))
        .send({ employeeId, documentType: "Citizenship", fileUrl: "https://example.com/citizenship.pdf" })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/organizations/me/staff-documents/${staffDoc.body.id}/review`)
        .set(...auth(tokenA))
        .send({ status: "VERIFIED" })
        .expect(200);

      // ── Certificates: issue → publicly verify (no auth at all) →
      // revoke → re-verify shows REVOKED.
      const certificate = await request(app.getHttpServer())
        .post("/organizations/me/certificates")
        .set(...auth(tokenA))
        .send({ studentId: student.body.id, type: "Transfer Certificate", fileUrl: "https://example.com/tc.pdf" })
        .expect(201);
      expect(certificate.body.status).toBe("ISSUED");
      expect(certificate.body.verificationCode).toMatch(/^[A-Z0-9]{10}$/);

      const verification = await request(app.getHttpServer())
        .get(`/verify/certificates/${certificate.body.verificationCode}`)
        .expect(200);
      expect(verification.body).toEqual({
        studentName: `Rita ${suffix}`,
        type: "Transfer Certificate",
        issuedAt: certificate.body.issuedAt,
        status: "ISSUED",
        revokedAt: null,
      });
      // The public verification response never leaks internal ids,
      // the file itself, or who issued it.
      expect(verification.body).not.toHaveProperty("id");
      expect(verification.body).not.toHaveProperty("organizationId");
      expect(verification.body).not.toHaveProperty("fileUrl");
      expect(verification.body).not.toHaveProperty("issuedByUserId");

      await request(app.getHttpServer()).get("/verify/certificates/NOTAREALCODE").expect(404);

      await request(app.getHttpServer())
        .post(`/organizations/me/certificates/${certificate.body.id}/revoke`)
        .set(...auth(tokenA))
        .send({ reason: "Issued in error" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/certificates/${certificate.body.id}/revoke`)
        .set(...auth(tokenA))
        .send({})
        .expect(409);

      const verificationAfterRevoke = await request(app.getHttpServer())
        .get(`/verify/certificates/${certificate.body.verificationCode}`)
        .expect(200);
      expect(verificationAfterRevoke.body.status).toBe("REVOKED");
      expect(verificationAfterRevoke.body.revokedAt).not.toBeNull();

      // ── Student self-service: own documents/certificates, IDOR-safe.
      const login = await request(app.getHttpServer())
        .post(`/organizations/me/students/${student.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "DocsPortalPass123" })
        .expect(201);
      const session = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: login.body.username, password: "DocsPortalPass123" })
        .expect(201);

      const ownDocsBefore = await request(app.getHttpServer())
        .get("/organizations/me/portal/documents")
        .set(...auth(session.body.accessToken))
        .expect(200);
      expect(ownDocsBefore.body).toHaveLength(2); // the two admin-uploaded ones from above

      const ownUpload = await request(app.getHttpServer())
        .post("/organizations/me/portal/documents")
        .set(...auth(session.body.accessToken))
        .send({ documentType: "Passport Photo", fileUrl: "https://example.com/passport.jpg" })
        .expect(201);
      expect(ownUpload.body.studentId).toBe(student.body.id);
      expect(ownUpload.body.status).toBe("PENDING");

      const ownDocsAfter = await request(app.getHttpServer())
        .get("/organizations/me/portal/documents")
        .set(...auth(session.body.accessToken))
        .expect(200);
      expect(ownDocsAfter.body).toHaveLength(3);

      const ownCertificates = await request(app.getHttpServer())
        .get("/organizations/me/portal/certificates")
        .set(...auth(session.body.accessToken))
        .expect(200);
      expect(ownCertificates.body).toHaveLength(1);
      expect(ownCertificates.body[0].id).toBe(certificate.body.id);

      // A second student's own portal never sees the first student's
      // documents (IDOR guard, by construction — studentId always
      // comes from the caller's own linked Student row).
      const student2 = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `DOC-STU2-${suffix}`, firstName: "Second", lastName: suffix, dateOfBirth: "2015-01-01" })
        .expect(201);
      const login2 = await request(app.getHttpServer())
        .post(`/organizations/me/students/${student2.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "DocsPortalPass456" })
        .expect(201);
      const session2 = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: login2.body.username, password: "DocsPortalPass456" })
        .expect(201);
      const student2Docs = await request(app.getHttpServer())
        .get("/organizations/me/portal/documents")
        .set(...auth(session2.body.accessToken))
        .expect(200);
      expect(student2Docs.body).toHaveLength(0);

      // ── Cross-tenant isolation.
      await request(app.getHttpServer())
        .post("/organizations/me/student-documents")
        .set(...auth(tokenB))
        .send({ studentId: student.body.id, documentType: "Intruder Doc", fileUrl: "https://example.com/x.pdf" })
        .expect(404);
      const orgBCertificates = await request(app.getHttpServer())
        .get("/organizations/me/certificates")
        .set(...auth(tokenB))
        .expect(200);
      expect(orgBCertificates.body.some((c: { id: string }) => c.id === certificate.body.id)).toBe(false);
      await request(app.getHttpServer())
        .post(`/organizations/me/certificates/${certificate.body.id}/revoke`)
        .set(...auth(tokenB))
        .send({})
        .expect(404);
      // The public verify endpoint, by contrast, works the same
      // regardless of which org's token (or no token) is presented —
      // that's the entire point of it having no tenant context.
      const verificationFromOrgB = await request(app.getHttpServer())
        .get(`/verify/certificates/${certificate.body.verificationCode}`)
        .set(...auth(tokenB))
        .expect(200);
      expect(verificationFromOrgB.body.status).toBe("REVOKED");
    }, 90000);
  });

  describe("Alumni & Career, part 1 (Phase 8 slice 8a)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    it("creates an alumni profile only for a graduated student, manages education/career/skills/certifications, supports self-service via the existing portal login, and stays tenant-scoped", async () => {
      const suffix = `ALM${run}`;

      const activeStudent = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `ALM-ACTIVE-${suffix}`, firstName: "Active", lastName: suffix, dateOfBirth: "2000-01-01" })
        .expect(201);

      // A profile can't be created for a student who hasn't graduated.
      await request(app.getHttpServer())
        .post("/organizations/me/alumni-profiles")
        .set(...auth(tokenA))
        .send({ studentId: activeStudent.body.id, graduationYear: 2024 })
        .expect(400);

      const student = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `ALM-STU-${suffix}`, firstName: "Grad", lastName: suffix, dateOfBirth: "2000-01-01" })
        .expect(201);
      await request(app.getHttpServer())
        .put(`/organizations/me/students/${student.body.id}/status`)
        .set(...auth(tokenA))
        .send({ status: "GRADUATED", reason: "Completed program", effectiveDate: "2024-06-01" })
        .expect(200);

      const profile = await request(app.getHttpServer())
        .post("/organizations/me/alumni-profiles")
        .set(...auth(tokenA))
        .send({ studentId: student.body.id, graduationYear: 2024 })
        .expect(201);
      expect(profile.body.student.firstName).toBe("Grad");

      // A student can't get a second alumni profile.
      await request(app.getHttpServer())
        .post("/organizations/me/alumni-profiles")
        .set(...auth(tokenA))
        .send({ studentId: student.body.id, graduationYear: 2024 })
        .expect(409);

      const listed = await request(app.getHttpServer())
        .get("/organizations/me/alumni-profiles")
        .set(...auth(tokenA))
        .expect(200);
      expect(listed.body.some((p: { id: string }) => p.id === profile.body.id)).toBe(true);

      const updated = await request(app.getHttpServer())
        .patch(`/organizations/me/alumni-profiles/${profile.body.id}`)
        .set(...auth(tokenA))
        .send({ currentOccupation: "Software Engineer", currentEmployer: "Acme Corp", isPubliclyVisible: true })
        .expect(200);
      expect(updated.body.currentOccupation).toBe("Software Engineer");
      expect(updated.body.isPubliclyVisible).toBe(true);

      // ── Companies — upsert-by-name, same as HostelLookup.
      const company = await request(app.getHttpServer())
        .post("/organizations/me/alumni-companies")
        .set(...auth(tokenA))
        .send({ name: `Acme Corp ${suffix}`, industry: "Software" })
        .expect(201);
      const companyAgain = await request(app.getHttpServer())
        .post("/organizations/me/alumni-companies")
        .set(...auth(tokenA))
        .send({ name: `Acme Corp ${suffix}` })
        .expect(201);
      expect(companyAgain.body.id).toBe(company.body.id);

      // ── Education, career history, skills, certifications.
      const education = await request(app.getHttpServer())
        .post(`/organizations/me/alumni-profiles/${profile.body.id}/education`)
        .set(...auth(tokenA))
        .send({ institutionName: `State University ${suffix}`, degree: "Master's", startYear: 2024, endYear: 2026 })
        .expect(201);

      const career = await request(app.getHttpServer())
        .post(`/organizations/me/alumni-profiles/${profile.body.id}/career-history`)
        .set(...auth(tokenA))
        .send({ companyId: company.body.id, jobTitle: "Junior Engineer", startDate: "2024-07-01" })
        .expect(201);
      expect(career.body.company.id).toBe(company.body.id);

      const careerUpdated = await request(app.getHttpServer())
        .patch(`/organizations/me/alumni-career-history/${career.body.id}`)
        .set(...auth(tokenA))
        .send({ endDate: "2025-12-31" })
        .expect(200);
      expect(careerUpdated.body.endDate).not.toBeNull();

      const skill = await request(app.getHttpServer())
        .post(`/organizations/me/alumni-profiles/${profile.body.id}/skills`)
        .set(...auth(tokenA))
        .send({ skillName: "TypeScript" })
        .expect(201);

      const certification = await request(app.getHttpServer())
        .post(`/organizations/me/alumni-profiles/${profile.body.id}/certifications`)
        .set(...auth(tokenA))
        .send({ name: "AWS Certified Developer", issuingOrganization: "Amazon" })
        .expect(201);

      const detail = await request(app.getHttpServer())
        .get(`/organizations/me/alumni-profiles/${profile.body.id}`)
        .set(...auth(tokenA))
        .expect(200);
      expect(detail.body.education).toHaveLength(1);
      expect(detail.body.careerHistory).toHaveLength(1);
      expect(detail.body.skills).toHaveLength(1);
      expect(detail.body.certifications).toHaveLength(1);

      // Removing sub-records.
      await request(app.getHttpServer()).delete(`/organizations/me/alumni-skills/${skill.body.id}`).set(...auth(tokenA)).expect(200);
      const afterRemove = await request(app.getHttpServer())
        .get(`/organizations/me/alumni-profiles/${profile.body.id}`)
        .set(...auth(tokenA))
        .expect(200);
      expect(afterRemove.body.skills).toHaveLength(0);

      // ── Self-service: the alumnus reuses their existing student
      // portal login.
      const login = await request(app.getHttpServer())
        .post(`/organizations/me/students/${student.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "AlumniPortalPass123" })
        .expect(201);
      const session = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: login.body.username, password: "AlumniPortalPass123" })
        .expect(201);

      const ownProfile = await request(app.getHttpServer())
        .get("/organizations/me/portal/alumni-profile")
        .set(...auth(session.body.accessToken))
        .expect(200);
      expect(ownProfile.body.id).toBe(profile.body.id);
      expect(ownProfile.body.education).toHaveLength(1);

      const ownProfileUpdated = await request(app.getHttpServer())
        .patch("/organizations/me/portal/alumni-profile")
        .set(...auth(session.body.accessToken))
        .send({ bio: "Building things." })
        .expect(200);
      expect(ownProfileUpdated.body.bio).toBe("Building things.");

      await request(app.getHttpServer())
        .post("/organizations/me/portal/alumni-profile/skills")
        .set(...auth(session.body.accessToken))
        .send({ skillName: "React" })
        .expect(201);
      const ownProfileAfterSkill = await request(app.getHttpServer())
        .get("/organizations/me/portal/alumni-profile")
        .set(...auth(session.body.accessToken))
        .expect(200);
      expect(ownProfileAfterSkill.body.skills).toHaveLength(1);
      expect(ownProfileAfterSkill.body.skills[0].skillName).toBe("React");

      // A student with no alumni profile gets a clean 404 through the
      // same self-service endpoint.
      const noProfileLogin = await request(app.getHttpServer())
        .post(`/organizations/me/students/${activeStudent.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "NoProfilePass123" })
        .expect(201);
      const noProfileSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: noProfileLogin.body.username, password: "NoProfilePass123" })
        .expect(201);
      await request(app.getHttpServer())
        .get("/organizations/me/portal/alumni-profile")
        .set(...auth(noProfileSession.body.accessToken))
        .expect(404);

      // ── Cross-tenant isolation.
      await request(app.getHttpServer())
        .post("/organizations/me/alumni-profiles")
        .set(...auth(tokenB))
        .send({ studentId: student.body.id, graduationYear: 2024 })
        .expect(404);
      const orgBProfiles = await request(app.getHttpServer())
        .get("/organizations/me/alumni-profiles")
        .set(...auth(tokenB))
        .expect(200);
      expect(orgBProfiles.body.some((p: { id: string }) => p.id === profile.body.id)).toBe(false);
      const orgBCompanies = await request(app.getHttpServer())
        .get("/organizations/me/alumni-companies")
        .set(...auth(tokenB))
        .expect(200);
      expect(orgBCompanies.body.some((c: { id: string }) => c.id === company.body.id)).toBe(false);
      expect(education.body.id).toBeTruthy();
      expect(certification.body.id).toBeTruthy();
    }, 90000);
  });

  describe("Alumni engagement — surveys, mentorship, achievements (Phase 8 slice 8b)", () => {
    const auth = (token: string) => ["Authorization", `Bearer ${token}`] as [string, string];

    it("runs a survey through DRAFT/PUBLISHED/CLOSED with self-service responses, a mentorship through REQUESTED/ACTIVE/COMPLETED both self-service and admin-driven, achievements, and stays tenant-scoped", async () => {
      const suffix = `ALME${run}`;

      // ── Set up a graduated alumnus (mentor) and a current student
      // (mentee), same pattern as slice 8a's own test.
      const mentorStudent = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `ALME-MENTOR-${suffix}`, firstName: "Mentor", lastName: suffix, dateOfBirth: "1999-01-01" })
        .expect(201);
      await request(app.getHttpServer())
        .put(`/organizations/me/students/${mentorStudent.body.id}/status`)
        .set(...auth(tokenA))
        .send({ status: "GRADUATED", reason: "Completed program", effectiveDate: "2023-06-01" })
        .expect(200);
      const mentorProfile = await request(app.getHttpServer())
        .post("/organizations/me/alumni-profiles")
        .set(...auth(tokenA))
        .send({ studentId: mentorStudent.body.id, graduationYear: 2023 })
        .expect(201);

      const menteeStudent = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `ALME-MENTEE-${suffix}`, firstName: "Mentee", lastName: suffix, dateOfBirth: "2005-01-01" })
        .expect(201);

      // ── Surveys: DRAFT → edit → PUBLISHED → response → CLOSED.
      const survey = await request(app.getHttpServer())
        .post("/organizations/me/alumni-surveys")
        .set(...auth(tokenA))
        .send({
          title: `Alumni check-in ${suffix}`,
          questions: [
            { id: "q1", text: "How's it going?", type: "TEXT" },
            { id: "q2", text: "Rate your experience", type: "RATING" },
          ],
        })
        .expect(201);
      expect(survey.body.status).toBe("DRAFT");

      // Editable while DRAFT.
      await request(app.getHttpServer())
        .patch(`/organizations/me/alumni-surveys/${survey.body.id}`)
        .set(...auth(tokenA))
        .send({ description: "Quick annual check-in" })
        .expect(200);

      // Can't publish an unpublished-yet survey twice, and can't
      // close a still-DRAFT one.
      await request(app.getHttpServer())
        .post(`/organizations/me/alumni-surveys/${survey.body.id}/close`)
        .set(...auth(tokenA))
        .expect(409);

      const published = await request(app.getHttpServer())
        .post(`/organizations/me/alumni-surveys/${survey.body.id}/publish`)
        .set(...auth(tokenA))
        .expect(201);
      expect(published.body.status).toBe("PUBLISHED");

      await request(app.getHttpServer())
        .post(`/organizations/me/alumni-surveys/${survey.body.id}/publish`)
        .set(...auth(tokenA))
        .expect(409);

      // Locked once PUBLISHED.
      await request(app.getHttpServer())
        .patch(`/organizations/me/alumni-surveys/${survey.body.id}`)
        .set(...auth(tokenA))
        .send({ title: "Should be rejected" })
        .expect(400);

      // ── Self-service: mentor logs in via the same portal login
      // pattern as 8a, sees the published survey, submits a response
      // once, and gets rejected on a second attempt.
      const mentorLogin = await request(app.getHttpServer())
        .post(`/organizations/me/students/${mentorStudent.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "MentorPortalPass123" })
        .expect(201);
      const mentorSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: mentorLogin.body.username, password: "MentorPortalPass123" })
        .expect(201);

      const publishedList = await request(app.getHttpServer())
        .get("/organizations/me/portal/alumni-surveys")
        .set(...auth(mentorSession.body.accessToken))
        .expect(200);
      expect(publishedList.body.some((s: { id: string }) => s.id === survey.body.id)).toBe(true);

      await request(app.getHttpServer())
        .post(`/organizations/me/portal/alumni-surveys/${survey.body.id}/responses`)
        .set(...auth(mentorSession.body.accessToken))
        .send({ answers: [{ questionId: "q1", value: "Great!" }, { questionId: "q2", value: "5" }] })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/organizations/me/portal/alumni-surveys/${survey.body.id}/responses`)
        .set(...auth(mentorSession.body.accessToken))
        .send({ answers: [{ questionId: "q1", value: "Again" }] })
        .expect(409);

      const responses = await request(app.getHttpServer())
        .get(`/organizations/me/alumni-surveys/${survey.body.id}/responses`)
        .set(...auth(tokenA))
        .expect(200);
      expect(responses.body).toHaveLength(1);
      expect(responses.body[0].alumniProfileId).toBe(mentorProfile.body.id);

      const closed = await request(app.getHttpServer())
        .post(`/organizations/me/alumni-surveys/${survey.body.id}/close`)
        .set(...auth(tokenA))
        .expect(201);
      expect(closed.body.status).toBe("CLOSED");

      await request(app.getHttpServer())
        .post(`/organizations/me/alumni-surveys/${survey.body.id}/close`)
        .set(...auth(tokenA))
        .expect(409);

      // ── Mentorship: admin creates the pairing, mentor responds/
      // completes it via self-service, mentee sees it read-only.
      const mentorship = await request(app.getHttpServer())
        .post("/organizations/me/alumni-mentorship")
        .set(...auth(tokenA))
        .send({ mentorAlumniProfileId: mentorProfile.body.id, menteeStudentId: menteeStudent.body.id, topic: "Career advice" })
        .expect(201);
      expect(mentorship.body.status).toBe("REQUESTED");

      const asMentor = await request(app.getHttpServer())
        .get("/organizations/me/portal/mentorships/as-mentor")
        .set(...auth(mentorSession.body.accessToken))
        .expect(200);
      expect(asMentor.body.some((m: { id: string }) => m.id === mentorship.body.id)).toBe(true);

      const accepted = await request(app.getHttpServer())
        .post(`/organizations/me/portal/mentorships/${mentorship.body.id}/respond`)
        .set(...auth(mentorSession.body.accessToken))
        .send({ status: "ACTIVE" })
        .expect(201);
      expect(accepted.body.status).toBe("ACTIVE");

      // Already responded — a second respond is rejected.
      await request(app.getHttpServer())
        .post(`/organizations/me/portal/mentorships/${mentorship.body.id}/respond`)
        .set(...auth(mentorSession.body.accessToken))
        .send({ status: "ACTIVE" })
        .expect(409);

      const completed = await request(app.getHttpServer())
        .post(`/organizations/me/portal/mentorships/${mentorship.body.id}/complete`)
        .set(...auth(mentorSession.body.accessToken))
        .expect(201);
      expect(completed.body.status).toBe("COMPLETED");

      await request(app.getHttpServer())
        .post(`/organizations/me/portal/mentorships/${mentorship.body.id}/complete`)
        .set(...auth(mentorSession.body.accessToken))
        .expect(409);

      // Mentee's own read-only view.
      const menteeLogin = await request(app.getHttpServer())
        .post(`/organizations/me/students/${menteeStudent.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "MenteePortalPass123" })
        .expect(201);
      const menteeSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: menteeLogin.body.username, password: "MenteePortalPass123" })
        .expect(201);
      const asMentee = await request(app.getHttpServer())
        .get("/organizations/me/portal/mentorships/as-mentee")
        .set(...auth(menteeSession.body.accessToken))
        .expect(200);
      expect(asMentee.body).toHaveLength(1);
      expect(asMentee.body[0].status).toBe("COMPLETED");

      // A second alumnus (not the mentor on this pairing) can't
      // respond to it — IDOR guard, 404 not 403 (same "not visible to
      // you" convention as everywhere else in this project).
      const otherStudent = await request(app.getHttpServer())
        .post("/organizations/me/students")
        .set(...auth(tokenA))
        .send({ studentCode: `ALME-OTHER-${suffix}`, firstName: "Other", lastName: suffix, dateOfBirth: "1998-01-01" })
        .expect(201);
      await request(app.getHttpServer())
        .put(`/organizations/me/students/${otherStudent.body.id}/status`)
        .set(...auth(tokenA))
        .send({ status: "GRADUATED", reason: "Completed program", effectiveDate: "2022-06-01" })
        .expect(200);
      await request(app.getHttpServer())
        .post("/organizations/me/alumni-profiles")
        .set(...auth(tokenA))
        .send({ studentId: otherStudent.body.id, graduationYear: 2022 })
        .expect(201);
      const otherLogin = await request(app.getHttpServer())
        .post(`/organizations/me/students/${otherStudent.body.id}/create-login`)
        .set(...auth(tokenA))
        .send({ password: "OtherPortalPass123" })
        .expect(201);
      const otherSession = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: otherLogin.body.username, password: "OtherPortalPass123" })
        .expect(201);

      const mentorship2 = await request(app.getHttpServer())
        .post("/organizations/me/alumni-mentorship")
        .set(...auth(tokenA))
        .send({ mentorAlumniProfileId: mentorProfile.body.id, menteeStudentId: menteeStudent.body.id })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organizations/me/portal/mentorships/${mentorship2.body.id}/respond`)
        .set(...auth(otherSession.body.accessToken))
        .send({ status: "ACTIVE" })
        .expect(404);

      // Admin can also drive respond/complete directly (not just
      // self-service) — same pairing, admin path this time.
      const adminAccepted = await request(app.getHttpServer())
        .post(`/organizations/me/alumni-mentorship/${mentorship2.body.id}/respond`)
        .set(...auth(tokenA))
        .send({ status: "ACTIVE" })
        .expect(201);
      expect(adminAccepted.body.status).toBe("ACTIVE");
      const adminCompleted = await request(app.getHttpServer())
        .post(`/organizations/me/alumni-mentorship/${mentorship2.body.id}/complete`)
        .set(...auth(tokenA))
        .expect(201);
      expect(adminCompleted.body.status).toBe("COMPLETED");

      // ── Achievements — both admin- and self-addable.
      const achievement = await request(app.getHttpServer())
        .post(`/organizations/me/alumni-profiles/${mentorProfile.body.id}/achievements`)
        .set(...auth(tokenA))
        .send({ title: "Distinguished Alumnus Award", achievedAt: "2025-01-01" })
        .expect(201);

      await request(app.getHttpServer())
        .post("/organizations/me/portal/alumni-profile/achievements")
        .set(...auth(mentorSession.body.accessToken))
        .send({ title: "Published a research paper" })
        .expect(201);

      const mentorProfileDetail = await request(app.getHttpServer())
        .get(`/organizations/me/alumni-profiles/${mentorProfile.body.id}`)
        .set(...auth(tokenA))
        .expect(200);
      expect(mentorProfileDetail.body.achievements).toHaveLength(2);

      await request(app.getHttpServer())
        .delete(`/organizations/me/alumni-achievements/${achievement.body.id}`)
        .set(...auth(tokenA))
        .expect(200);
      const afterRemove = await request(app.getHttpServer())
        .get(`/organizations/me/alumni-profiles/${mentorProfile.body.id}`)
        .set(...auth(tokenA))
        .expect(200);
      expect(afterRemove.body.achievements).toHaveLength(1);

      // ── Cross-tenant isolation.
      const orgBSurveys = await request(app.getHttpServer())
        .get("/organizations/me/alumni-surveys")
        .set(...auth(tokenB))
        .expect(200);
      expect(orgBSurveys.body.some((s: { id: string }) => s.id === survey.body.id)).toBe(false);
      const orgBMentorships = await request(app.getHttpServer())
        .get("/organizations/me/alumni-mentorship")
        .set(...auth(tokenB))
        .expect(200);
      expect(orgBMentorships.body.some((m: { id: string }) => m.id === mentorship.body.id)).toBe(false);
      await request(app.getHttpServer())
        .post("/organizations/me/alumni-mentorship")
        .set(...auth(tokenB))
        .send({ mentorAlumniProfileId: mentorProfile.body.id, menteeStudentId: menteeStudent.body.id })
        .expect(404);
    }, 120000);
  });
});
