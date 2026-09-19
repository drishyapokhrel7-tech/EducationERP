import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { parse } from "csv-parse/sync";
import * as argon2 from "argon2";
import { Prisma, PrismaClient } from "@prisma/client";
import { buildWorkbook, parseWorkbookRows, type ColumnSpec } from "../../common/excel-sync";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateStudentDto } from "./dto/create-student.dto";
import { UpdateStudentDto } from "./dto/update-student.dto";
import { CreateGuardianDto } from "./dto/create-guardian.dto";
import { UpdateGuardianDto } from "./dto/update-guardian.dto";
import { AttachGuardianDto } from "./dto/attach-guardian.dto";
import { CreateEnrollmentDto } from "./dto/create-enrollment.dto";
import { ListEnrollmentsQueryDto } from "./dto/list-enrollments.dto";
import { UpdateEnrollmentStatusDto } from "./dto/update-enrollment-status.dto";
import { BulkPromoteDto } from "./dto/bulk-promote.dto";
import { BulkPromoteResult, BulkPromoteRowError } from "./dto/bulk-promote-result.dto";
import { CreateExtracurricularActivityDto } from "./dto/create-extracurricular-activity.dto";
import { UpdateExtracurricularActivityDto } from "./dto/update-extracurricular-activity.dto";
import { ListExtracurricularActivitiesQueryDto } from "./dto/list-extracurricular-activities.dto";
import { CreateActivityLookupDto } from "./dto/create-activity-lookup.dto";
import { UpdateActivityLookupDto } from "./dto/update-activity-lookup.dto";
import { ExtracurricularActivityLookupKind } from "@prisma/client";
import { UpdateStudentStatusDto } from "./dto/update-student-status.dto";
import { CreateStudentLoginDto } from "./dto/create-student-login.dto";
import { CreateGuardianLoginDto } from "./dto/create-guardian-login.dto";
import { ImportResult, ImportRowError } from "./dto/import-result.dto";
import { assertUnderEditionLimit, editionLimit } from "../organizations/edition-limits";
import { paginate } from "../../common/pagination";
import { assertNoDependents } from "../../common/assert-no-dependents";

// Canonical gender values — shown as an Excel dropdown in the import
// template and enforced on import (both CSV and .xlsx), so the
// standardization the template exists for is actually held to.
// Deliberately still a free `String` column at the DB layer (not a
// Prisma enum, per Student.gender's own schema comment: categories
// vary by institution/jurisdiction) — this list can change without a
// migration, just edit it here and in the frontend's matching
// dropdown (apps/web/src/app/dashboard/students/page.tsx).
const GENDER_OPTIONS = ["Male", "Female", "Other"] as const;

// Same standardization goal as GENDER_OPTIONS above (a common, seeded
// list so "Father" isn't also typed "father"/"Dad"/"Guardian(Father)"
// depending on who's entering it) — enforced here so a bare API call
// can't bypass the frontend's dropdown. Deliberately still a free
// `String` column at the DB layer (StudentGuardian.relationship's own
// schema comment: family structures aren't a fixed enum) — this list
// can change without a migration, just edit it here and in the
// frontend's matching dropdown (apps/web/src/app/dashboard/students/
// page.tsx), same duplication convention as GENDER_OPTIONS.
const RELATIONSHIP_OPTIONS = [
  "Father",
  "Mother",
  "Son",
  "Daughter",
  "Husband",
  "Wife",
  "Brother",
  "Sister",
  "Grandfather",
  "Grandmother",
  "Uncle",
  "Aunt",
  "Cousin",
  "Friend",
  "Colleague",
  "Supervisor",
  "Subordinate",
  "Neighbor",
  "Guardian",
  "Emergency Contact",
  "Associate",
  "Business Partner",
  "Unknown",
] as const;

/** Same load-bearing parent-guard pattern as every prior slice's service. */
@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  // Deliberately unbounded, deliberately narrow — every "pick a
  // student" dropdown across the app (attendance, exams, hostel,
  // transport, biometric enrollment, knowledge checks, documents,
  // alumni, finance, ...) needs the *whole* roster, not one page of
  // it, but none of them need the guardian graph listStudents()
  // includes. A flat id/name/code/status projection over an indexed
  // table stays cheap even at Ultra-edition scale (no record cap) —
  // categorically different from listStudents()'s original problem,
  // which was the heavy include on every row, not the row count alone.
  // Phase 8 performance-optimization slice.
  // Returns photoUrl and the student's current program/section (their
  // most recent enrollment) alongside the name/code — every "pick a
  // student" dropdown in the app renders an avatar + identity line
  // from this, not just a name, so a cashier/teacher can tell two
  // same-named students apart. The extra photoUrl column and a
  // single take:1 enrollment sub-select keep this well within the
  // "one cheap query, no cap concern" budget the picker already had.
  listStudentsPicker(organizationId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const students = await tx.student.findMany({
        where: { organizationId, deletedAt: null },
        select: {
          id: true,
          userId: true,
          firstName: true,
          middleName: true,
          lastName: true,
          studentCode: true,
          status: true,
          photoUrl: true,
          enrollments: {
            select: { program: { select: { name: true } }, section: { select: { name: true } } },
            orderBy: { enrollmentDate: "desc" },
            take: 1,
          },
        },
        orderBy: [{ firstName: "asc" }, { middleName: "asc" }, { lastName: "asc" }],
      });
      return students.map(({ enrollments, ...s }) => ({
        ...s,
        programName: enrollments[0]?.program.name ?? null,
        sectionName: enrollments[0]?.section?.name ?? null,
      }));
    });
  }

  // Org letterhead + one student's ID-card fields (name/code/photo/
  // dob/gender + current class from the latest enrollment). Letterhead
  // read outside withTenant, same as the other *Document methods.
  async getStudentIdCardDocument(organizationId: string, studentId: string) {
    const [org, row] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { name: true, address: true, phone: true, email: true, website: true, logoUrl: true },
      }),
      this.prisma.withTenant(organizationId, (tx) =>
        tx.student.findUnique({
          where: { id: studentId },
          select: {
            firstName: true,
            lastName: true,
            studentCode: true,
            photoUrl: true,
            dateOfBirth: true,
            gender: true,
            enrollments: {
              select: { program: { select: { name: true } }, section: { select: { name: true } } },
              orderBy: { enrollmentDate: "desc" },
              take: 1,
            },
          },
        }),
      ),
    ]);
    if (!row) throw new NotFoundException("Student not found");
    const { enrollments, ...s } = row;
    return {
      org,
      student: {
        ...s,
        programName: enrollments[0]?.program.name ?? null,
        sectionName: enrollments[0]?.section?.name ?? null,
      },
    };
  }

  // Paginated (Phase 8 performance-optimization slice) — this was an
  // unbounded findMany. `orderBy` is required for skip/take to be
  // well-defined at all (Postgres gives no ordering guarantee across
  // two paginated reads without one); newest-first also means a
  // freshly-created student naturally lands on page 1.
  listStudents(organizationId: string, page: number, pageSize: number) {
    return this.prisma.withTenant(organizationId, (tx) => {
      const where = { organizationId, deletedAt: null };
      return paginate(
        () =>
          tx.student.findMany({
            where,
            include: { guardians: { include: { guardian: true } } },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
        () => tx.student.count({ where }),
        page,
        pageSize,
      );
    });
  }

  // System-generated, not user-typed — "STU-0001", "STU-0002", ...,
  // sequential per organization (matches the format already used by
  // seed-demo.ts's own fixtures). Counts ALL students ever created for
  // this org, not just active ones (`deletedAt: null` would let a
  // deleted student's code get reused, which is confusing for anything
  // that still references the old code historically — e.g. an
  // invoice). A handful of retries on the (organizationId, studentCode)
  // unique constraint (schema.prisma) covers the rare concurrent-create
  // race without needing a real DB sequence for what is, at this
  // project's real scale, an infrequent admin action.
  // Not private — AdmissionsService.enroll reuses this exact rule
  // rather than hand-typing a code on that creation path (see that
  // method's own comment).
  async nextStudentCode(tx: PrismaClient, organizationId: string): Promise<string> {
    const count = await tx.student.count({ where: { organizationId } });
    return `STU-${String(count + 1).padStart(4, "0")}`;
  }

  async createStudent(organizationId: string, dto: CreateStudentDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await assertUnderEditionLimit(tx, organizationId);
      const maxAttempts = 5;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const studentCode = await this.nextStudentCode(tx, organizationId);
        try {
          return await tx.student.create({
            data: {
              organizationId,
              studentCode,
              firstName: dto.firstName,
              middleName: dto.middleName,
              lastName: dto.lastName,
              dateOfBirth: new Date(dto.dateOfBirth),
              gender: dto.gender,
              photoUrl: dto.photoUrl,
            },
          });
        } catch (err) {
          const isUniqueViolation = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
          if (!isUniqueViolation || attempt === maxAttempts) throw err;
          // Another concurrent create took this code first — recompute
          // and try again.
        }
      }
      throw new Error("Could not generate a unique student code — please try again");
    });
  }

  async updateStudent(organizationId: string, id: string, dto: UpdateStudentDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadStudent(tx, organizationId, id);
      return tx.student.update({
        where: { id },
        data: {
          firstName: dto.firstName,
          middleName: dto.middleName,
          lastName: dto.lastName,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          gender: dto.gender,
          photoUrl: dto.photoUrl,
        },
      });
    });
  }

  // A real student record accumulates dependents almost immediately
  // (an enrollment, an attendance mark, an invoice, ...) — this guard
  // is expected to block deletion for any student who has actually
  // done anything in the system, same as every other guarded delete in
  // this app. It exists for the case this is actually for: a record
  // created by mistake (wrong person, duplicate import row) that
  // nothing else references yet. A portal login is blocked
  // separately — deleting the Student out from under a live User
  // account (sessions, notifications, audit trail all keyed to that
  // userId) is a different, bigger operation than this endpoint does.
  async deleteStudent(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const student = await this.loadStudent(tx, organizationId, id);
      if (student.userId) {
        throw new ConflictException("This student has a portal login — remove that first before deleting the record");
      }
      await assertNoDependents(
        [
          tx.studentGuardian.count({ where: { studentId: id } }),
          tx.studentEnrollment.count({ where: { studentId: id } }),
          tx.studentStatusHistory.count({ where: { studentId: id } }),
          tx.studentAttendance.count({ where: { studentId: id } }),
          tx.faceEnrollment.count({ where: { studentId: id } }),
          tx.assignmentSubmission.count({ where: { studentId: id } }),
          tx.knowledgeCheckAttempt.count({ where: { studentId: id } }),
          tx.examAttempt.count({ where: { studentId: id } }),
          tx.reportCard.count({ where: { studentId: id } }),
          tx.invoice.count({ where: { studentId: id } }),
          tx.studentScholarship.count({ where: { studentId: id } }),
          tx.courseModuleItemCompletion.count({ where: { studentId: id } }),
          tx.studentDocument.count({ where: { studentId: id } }),
          tx.certificate.count({ where: { studentId: id } }),
          tx.alumniProfile.count({ where: { studentId: id } }),
        ],
        "student",
      );
      await tx.student.delete({ where: { id } });
      return { deleted: true };
    });
  }

  private async loadStudent(tx: PrismaClient, organizationId: string, id: string) {
    const student = await tx.student.findUnique({ where: { id } });
    if (!student || student.organizationId !== organizationId) throw new NotFoundException("Student not found");
    return student;
  }

  listGuardians(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.guardian.findMany({
        where: { organizationId },
        orderBy: [{ firstName: "asc" }, { middleName: "asc" }, { lastName: "asc" }],
      }),
    );
  }

  createGuardian(organizationId: string, dto: CreateGuardianDto) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.guardian.create({
        data: {
          organizationId,
          firstName: dto.firstName,
          middleName: dto.middleName,
          lastName: dto.lastName,
          phone: dto.phone,
          email: dto.email,
          occupation: dto.occupation,
          photoUrl: dto.photoUrl,
        },
      }),
    );
  }

  async updateGuardian(organizationId: string, id: string, dto: UpdateGuardianDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadGuardian(tx, organizationId, id);
      return tx.guardian.update({
        where: { id },
        data: {
          firstName: dto.firstName,
          middleName: dto.middleName,
          lastName: dto.lastName,
          phone: dto.phone,
          email: dto.email,
          occupation: dto.occupation,
          photoUrl: dto.photoUrl,
        },
      });
    });
  }

  async deleteGuardian(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadGuardian(tx, organizationId, id);
      await assertNoDependents([tx.studentGuardian.count({ where: { guardianId: id } })], "guardian");
      await tx.guardian.delete({ where: { id } });
      return { deleted: true };
    });
  }

  private async loadGuardian(tx: PrismaClient, organizationId: string, id: string) {
    const guardian = await tx.guardian.findUnique({ where: { id } });
    if (!guardian || guardian.organizationId !== organizationId) throw new NotFoundException("Guardian not found");
    return guardian;
  }

  private async requireStudent(organizationId: string, studentId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const student = await tx.student.findUnique({ where: { id: studentId } });
      if (!student) throw new NotFoundException("Student not found");
      return student;
    });
  }

  async attachGuardian(organizationId: string, studentId: string, dto: AttachGuardianDto) {
    if (!(RELATIONSHIP_OPTIONS as readonly string[]).includes(dto.relationship)) {
      throw new BadRequestException(
        `Invalid relationship "${dto.relationship}" — must be one of ${RELATIONSHIP_OPTIONS.join(", ")}`,
      );
    }
    await this.requireStudent(organizationId, studentId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      const guardian = await tx.guardian.findUnique({ where: { id: dto.guardianId } });
      if (!guardian) throw new NotFoundException("Guardian not found");

      return tx.studentGuardian.create({
        data: {
          organizationId,
          studentId,
          guardianId: dto.guardianId,
          relationship: dto.relationship,
          isPrimaryContact: dto.isPrimaryContact ?? false,
        },
      });
    });
  }

  async listEnrollments(organizationId: string, studentId: string) {
    await this.requireStudent(organizationId, studentId);
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.studentEnrollment.findMany({
        where: { organizationId, studentId },
        include: { program: true, section: true, semester: true },
      }),
    );
  }

  // Org-wide, filterable, paginated — the real list view the
  // Enrollment card was missing (it previously hardcoded `items` to
  // nothing, so the only feedback after enrolling was a toast, with
  // no way to see who's enrolled or spot a double-enrollment).
  listAllEnrollments(organizationId: string, filters: ListEnrollmentsQueryDto) {
    return this.prisma.withTenant(organizationId, (tx) => {
      const where = {
        organizationId,
        ...(filters.programId ? { programId: filters.programId } : {}),
        ...(filters.semesterId ? { semesterId: filters.semesterId } : {}),
        ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      };
      return paginate(
        () =>
          tx.studentEnrollment.findMany({
            where,
            include: { student: true, program: true, section: true, semester: true },
            orderBy: [{ student: { firstName: "asc" } }, { student: { lastName: "asc" } }],
            skip: ((filters.page ?? 1) - 1) * (filters.pageSize ?? 25),
            take: filters.pageSize ?? 25,
          }),
        () => tx.studentEnrollment.count({ where }),
        filters.page ?? 1,
        filters.pageSize ?? 25,
      );
    });
  }

  // "Un-enroll" is a status transition, not a delete — see
  // UpdateEnrollmentStatusDto's own comment.
  async updateEnrollmentStatus(organizationId: string, id: string, dto: UpdateEnrollmentStatusDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const enrollment = await tx.studentEnrollment.findUnique({ where: { id } });
      if (!enrollment || enrollment.organizationId !== organizationId) throw new NotFoundException("Enrollment not found");
      return tx.studentEnrollment.update({
        where: { id },
        data: { status: dto.status },
        include: { student: true, program: true, section: true, semester: true },
      });
    });
  }

  async createEnrollment(organizationId: string, studentId: string, dto: CreateEnrollmentDto) {
    await this.requireStudent(organizationId, studentId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      const [program, section, semester] = await Promise.all([
        tx.program.findUnique({ where: { id: dto.programId } }),
        dto.sectionId ? tx.section.findUnique({ where: { id: dto.sectionId } }) : null,
        tx.semester.findUnique({ where: { id: dto.semesterId } }),
      ]);
      if (!program) throw new NotFoundException("Program not found");
      if (dto.sectionId && !section) throw new NotFoundException("Section not found");
      if (!semester) throw new NotFoundException("Semester not found");

      return tx.studentEnrollment.create({
        data: {
          organizationId,
          studentId,
          programId: dto.programId,
          sectionId: dto.sectionId,
          semesterId: dto.semesterId,
          enrollmentDate: new Date(dto.enrollmentDate),
        },
      });
    });
  }

  // Bulk promotion / graduation — the year-end workflow this schema's
  // per-student StudentEnrollment never had a batch action for. Each
  // entry closes out one ACTIVE enrollment (status -> COMPLETED) and
  // either opens a new one in the target program/semester/section
  // (PROMOTE/RETAIN — RETAIN just targets the *same* program/semester,
  // i.e. held back a year) or marks the student GRADUATED via the same
  // updateStatus data shape used everywhere else, rather than a
  // parallel status-write path. Per-row error collection, same
  // "don't let one bad row kill the batch" reasoning as importStudents
  // — this is a curated, admin-reviewed list, but still spans many
  // students in one submit.
  async bulkPromote(organizationId: string, dto: BulkPromoteDto): Promise<BulkPromoteResult> {
    const errors: BulkPromoteRowError[] = [];
    let promoted = 0;
    let retained = 0;
    let graduated = 0;

    await this.prisma.withTenant(organizationId, async (tx) => {
      for (const entry of dto.entries) {
        const enrollment = await tx.studentEnrollment.findUnique({ where: { id: entry.enrollmentId } });
        if (!enrollment || enrollment.organizationId !== organizationId) {
          errors.push({ enrollmentId: entry.enrollmentId, message: "Enrollment not found" });
          continue;
        }
        if (enrollment.status !== "ACTIVE") {
          errors.push({ enrollmentId: entry.enrollmentId, message: `Enrollment is already ${enrollment.status}` });
          continue;
        }

        if (entry.action === "GRADUATE") {
          // Sequential, not Promise.all — same reasoning as updateStatus:
          // this write and the enrollment closure below need to commit
          // together.
          await tx.student.update({ where: { id: enrollment.studentId }, data: { status: "GRADUATED" } });
          await tx.studentStatusHistory.create({
            data: {
              organizationId,
              studentId: enrollment.studentId,
              status: "GRADUATED",
              reason: "Bulk promotion — graduated",
              effectiveDate: new Date(),
            },
          });
          await tx.studentEnrollment.update({ where: { id: enrollment.id }, data: { status: "COMPLETED" } });
          graduated++;
          continue;
        }

        // PROMOTE or RETAIN — both open a new enrollment, only the
        // target cohort differs (RETAIN keeps the same program/semester,
        // i.e. held back), so both need the same target fields.
        if (!entry.targetProgramId || !entry.targetSemesterId) {
          errors.push({ enrollmentId: entry.enrollmentId, message: "targetProgramId and targetSemesterId are required" });
          continue;
        }
        const [program, section, semester] = await Promise.all([
          tx.program.findUnique({ where: { id: entry.targetProgramId } }),
          entry.targetSectionId ? tx.section.findUnique({ where: { id: entry.targetSectionId } }) : null,
          tx.semester.findUnique({ where: { id: entry.targetSemesterId } }),
        ]);
        if (!program) {
          errors.push({ enrollmentId: entry.enrollmentId, message: "Target program not found" });
          continue;
        }
        if (entry.targetSectionId && !section) {
          errors.push({ enrollmentId: entry.enrollmentId, message: "Target section not found" });
          continue;
        }
        if (!semester) {
          errors.push({ enrollmentId: entry.enrollmentId, message: "Target semester not found" });
          continue;
        }
        // StudentEnrollment's own @@unique([studentId, semesterId]) means
        // a student can only ever have one enrollment (of any status) per
        // semester — pre-checked here for a clear per-row error instead
        // of a raw constraint violation surfacing as a 500. The common
        // real cause is picking the *same* semester as both source and
        // target (e.g. testing, or a genuine double-promotion attempt).
        const targetConflict = await tx.studentEnrollment.findUnique({
          where: { studentId_semesterId: { studentId: enrollment.studentId, semesterId: entry.targetSemesterId } },
        });
        if (targetConflict) {
          errors.push({ enrollmentId: entry.enrollmentId, message: "Student already has an enrollment in the target semester" });
          continue;
        }

        await tx.studentEnrollment.update({ where: { id: enrollment.id }, data: { status: "COMPLETED" } });
        await tx.studentEnrollment.create({
          data: {
            organizationId,
            studentId: enrollment.studentId,
            programId: entry.targetProgramId,
            sectionId: entry.targetSectionId,
            semesterId: entry.targetSemesterId,
            enrollmentDate: entry.enrollmentDate ? new Date(entry.enrollmentDate) : new Date(),
          },
        });
        if (entry.action === "RETAIN") retained++;
        else promoted++;
      }
    });

    return { promoted, retained, graduated, errors };
  }

  // ── Extra-curricular activities ──────────────────────────────────

  async listActivities(organizationId: string, studentId: string) {
    await this.requireStudent(organizationId, studentId);
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.extracurricularActivity.findMany({ where: { organizationId, studentId }, orderBy: { startDate: "desc" } }),
    );
  }

  async createActivity(organizationId: string, studentId: string, dto: CreateExtracurricularActivityDto) {
    await this.requireStudent(organizationId, studentId);
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.extracurricularActivity.create({
        data: {
          organizationId,
          studentId,
          title: dto.title,
          role: dto.role,
          description: dto.description,
          startDate: new Date(dto.startDate),
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        },
      }),
    );
  }

  // Org-wide, filterable, paginated — mirrors listAllEnrollments.
  listAllActivities(organizationId: string, filters: ListExtracurricularActivitiesQueryDto) {
    return this.prisma.withTenant(organizationId, (tx) => {
      const where = {
        organizationId,
        ...(filters.studentId ? { studentId: filters.studentId } : {}),
      };
      return paginate(
        () =>
          tx.extracurricularActivity.findMany({
            where,
            include: { student: true },
            orderBy: [{ student: { firstName: "asc" } }, { student: { lastName: "asc" } }],
            skip: ((filters.page ?? 1) - 1) * (filters.pageSize ?? 25),
            take: filters.pageSize ?? 25,
          }),
        () => tx.extracurricularActivity.count({ where }),
        filters.page ?? 1,
        filters.pageSize ?? 25,
      );
    });
  }

  async updateActivity(organizationId: string, id: string, dto: UpdateExtracurricularActivityDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const activity = await tx.extracurricularActivity.findUnique({ where: { id } });
      if (!activity || activity.organizationId !== organizationId) throw new NotFoundException("Activity not found");
      return tx.extracurricularActivity.update({
        where: { id },
        data: {
          title: dto.title,
          role: dto.role,
          description: dto.description,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        },
      });
    });
  }

  async deleteActivity(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const activity = await tx.extracurricularActivity.findUnique({ where: { id } });
      if (!activity || activity.organizationId !== organizationId) throw new NotFoundException("Activity not found");
      await tx.extracurricularActivity.delete({ where: { id } });
      return { deleted: true };
    });
  }

  // Upsert-by-name, same reasoning as HostelService.createLookup — the
  // frontend's inline "+ Add new" flow can safely re-submit an
  // already-listed value without erroring or duplicating it.
  createActivityLookup(organizationId: string, dto: CreateActivityLookupDto) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.extracurricularActivityLookup.upsert({
        where: { organizationId_kind_name: { organizationId, kind: dto.kind, name: dto.name } },
        update: {},
        create: { organizationId, kind: dto.kind, name: dto.name },
      }),
    );
  }

  listActivityLookups(organizationId: string, kind?: ExtracurricularActivityLookupKind) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.extracurricularActivityLookup.findMany({ where: { organizationId, kind }, orderBy: { name: "asc" } }),
    );
  }

  async updateActivityLookup(organizationId: string, id: string, dto: UpdateActivityLookupDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadActivityLookup(tx, organizationId, id);
      return tx.extracurricularActivityLookup.update({ where: { id }, data: dto });
    });
  }

  // No assertNoDependents here, deliberately — same reasoning as
  // HostelService.deleteLookup: ExtracurricularActivity.title/role store
  // plain strings, not FKs, so removing a catalog entry never orphans or
  // blocks deleting historical activity records.
  async deleteActivityLookup(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadActivityLookup(tx, organizationId, id);
      await tx.extracurricularActivityLookup.delete({ where: { id } });
      return { deleted: true };
    });
  }

  private async loadActivityLookup(tx: PrismaClient, organizationId: string, id: string) {
    const lookup = await tx.extracurricularActivityLookup.findUnique({ where: { id } });
    if (!lookup || lookup.organizationId !== organizationId) throw new NotFoundException("Activity lookup not found");
    return lookup;
  }

  async listStatusHistory(organizationId: string, studentId: string) {
    await this.requireStudent(organizationId, studentId);
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.studentStatusHistory.findMany({ where: { organizationId, studentId } }),
    );
  }

  async updateStatus(organizationId: string, studentId: string, dto: UpdateStudentStatusDto) {
    await this.requireStudent(organizationId, studentId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      // Sequential, not Promise.all: both are writes sharing the same
      // interactive-transaction connection, and this update+history pair
      // needs to commit or roll back together, not race each other.
      await tx.student.update({ where: { id: studentId }, data: { status: dto.status } });
      return tx.studentStatusHistory.create({
        data: {
          organizationId,
          studentId,
          status: dto.status,
          reason: dto.reason,
          effectiveDate: new Date(dto.effectiveDate),
        },
      });
    });
  }

  /**
   * Admin-set password only — the API never generates or echoes one back
   * (see CreateStudentLoginDto). `username` is
   * `{organizationSlug}.{studentCode}`, globally unique the same way
   * User.email is, since studentCode is only unique within an
   * organization — this is what lets AuthService.login look up either
   * column with one identifier field.
   */
  async createLogin(organizationId: string, studentId: string, dto: CreateStudentLoginDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const student = await tx.student.findUnique({ where: { id: studentId } });
      if (!student) throw new NotFoundException("Student not found");
      if (student.userId) throw new ConflictException("This student already has a login");

      const organization = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!organization) throw new NotFoundException("Organization not found");

      const studentRole = await tx.role.findFirst({ where: { name: "Student", isSystem: true } });
      if (!studentRole) throw new Error("System roles are not seeded — run prisma:seed first");

      const username = `${organization.slug}.${student.studentCode}`;
      const passwordHash = await argon2.hash(dto.password);

      const user = await tx.user.create({
        data: {
          organizationId,
          // User.email stays required+unique (not touched by this
          // slice — see plan) so a placeholder is needed; `username`
          // is already globally unique, this just reuses it under a
          // reserved pseudo-TLD. The student never sees or logs in
          // with this value — only `username` is relayed to them.
          email: `${username}@student.local`,
          username,
          passwordHash,
          firstName: student.firstName,
          lastName: student.lastName,
          status: "ACTIVE",
          userRoles: { create: { roleId: studentRole.id } },
        },
      });
      await tx.student.update({ where: { id: studentId }, data: { userId: user.id } });

      const { passwordHash: _passwordHash, ...safeUser } = user;
      return { ...safeUser, username };
    });
  }

  /**
   * Mirrors createLogin above, with one deliberate difference: no role
   * is assigned. This matches StaffService.createLogin (Teacher/Driver
   * logins), not this method's own Student case — a guardian's portal
   * routes are JwtAuthGuard-only, ownership-derived from userId, never
   * gated by a permission string, so a role would grant nothing.
   */
  async createGuardianLogin(organizationId: string, guardianId: string, dto: CreateGuardianLoginDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const guardian = await tx.guardian.findUnique({ where: { id: guardianId } });
      if (!guardian) throw new NotFoundException("Guardian not found");
      if (guardian.userId) throw new ConflictException("This guardian already has a login");

      const organization = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!organization) throw new NotFoundException("Organization not found");

      // Guardian has no unique code the way Student (studentCode) and
      // Employee (employeeCode) do — phone/email aren't guaranteed
      // unique across guardians. A slice of the guardian's own id
      // (already globally unique) avoids inventing a scheme that could
      // collide.
      const username = `${organization.slug}.guardian.${guardian.id.slice(0, 8)}`;
      const passwordHash = await argon2.hash(dto.password);

      const user = await tx.user.create({
        data: {
          organizationId,
          email: `${username}@guardian.local`,
          username,
          passwordHash,
          firstName: guardian.firstName,
          lastName: guardian.lastName,
          status: "ACTIVE",
        },
      });
      await tx.guardian.update({ where: { id: guardianId }, data: { userId: user.id } });

      const { passwordHash: _passwordHash, ...safeUser } = user;
      return { ...safeUser, username };
    });
  }

  /**
   * Parses in-memory, never persists the file — the object-storage
   * backend for real document uploads is still an open decision (see
   * PHASE_1_NOTES.md); a transient parse-then-discard CSV import doesn't
   * need it. Invalid/duplicate rows are skipped and reported, not fatal
   * to the whole batch — "rollback where practical" (plan §19) applied
   * per-row, since each row is a single independent insert.
   */
  // Matches the studentCode a row is keyed on against an existing
  // student to decide create vs. update — the actual "round trip" this
  // was built for: download exportEditableStudents(), edit rows in real
  // Excel (change a name, add a new row with a blank studentCode), and
  // re-upload here to apply both kinds of change in one pass, instead of
  // create-only rejecting any row that happens to match an existing
  // record.
  async importStudents(organizationId: string, fileBuffer: Buffer, originalName: string): Promise<ImportResult> {
    // Accepts the .xlsx template/export (download via
    // generateImportTemplate/exportEditableStudents) as well as plain
    // CSV — decided by extension, not content-sniffing, since a valid
    // CSV can't be told apart from garbage by trying to parse it as
    // xlsx first. Both paths converge on the same Record<string,string>[]
    // shape the row-validation loop below already expects, so nothing
    // past this point needs to know which format the file came in as.
    let records: Record<string, string>[];
    if (/\.xlsx$/i.test(originalName)) {
      try {
        records = await parseWorkbookRows(fileBuffer);
      } catch (err) {
        throw new BadRequestException((err as Error).message);
      }
    } else {
      try {
        // csv-parse's `parse()` return type is untyped `any` regardless
        // of input (checked the .d.ts — no generic support in this
        // version); the cast documents the shape `columns: true`
        // actually produces.
        records = parse(fileBuffer, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        }) as Record<string, string>[];
      } catch (err) {
        throw new BadRequestException(`Could not parse CSV: ${(err as Error).message}`);
      }
    }

    const errors: ImportRowError[] = [];
    let created = 0;
    let updated = 0;

    await this.prisma.withTenant(organizationId, async (tx) => {
      // One upfront read instead of a per-row findFirst — the whole
      // batch runs inside this single transaction, so no concurrent
      // write can appear between here and the loop below. A per-row
      // round trip is what previously blew the 15s transaction
      // timeout on a 76-row file under ordinary Neon latency.
      // Full rows, not just id+code — a re-sync of a large roster where
      // only one row actually changed shouldn't write all the others
      // back unchanged; the loop below compares against these before
      // calling update.
      const existingRows = await tx.student.findMany({
        where: { organizationId },
        select: { id: true, studentCode: true, firstName: true, lastName: true, dateOfBirth: true, gender: true },
      });
      const existingByCode = new Map(existingRows.map((s) => [s.studentCode, s]));
      const seenCodes = new Set<string>();

      // Same licensing cap as the single-record createStudent path —
      // a CSV import is just another way to add student records, so
      // it needs the same gate, not a bypass, but only for rows that
      // actually create a new student (an update never touches this
      // count). Checked once up front (edition + current combined
      // count) and tracked as a running total per successful create,
      // rather than a fresh query per row, for the same "one
      // transaction, no N round trips" reasoning already documented
      // above for existingByCode.
      const organization = await tx.organization.findUnique({ where: { id: organizationId } });
      const limit = organization ? editionLimit(organization.edition) : 0;
      const [activeStudentCount, activeEmployeeCount] = await Promise.all([
        tx.student.count({ where: { organizationId, deletedAt: null } }),
        tx.employee.count({ where: { organizationId, deletedAt: null } }),
      ]);
      let combinedCount = activeStudentCount + activeEmployeeCount;

      for (let i = 0; i < records.length; i++) {
        const rowNumber = i + 2; // header occupies row 1
        const row = records[i];
        const studentCode = row.studentCode?.trim();
        const firstName = row.firstName?.trim();
        const lastName = row.lastName?.trim();
        const dateOfBirthRaw = row.dateOfBirth?.trim();
        const gender = row.gender?.trim() || undefined;

        if (!firstName || !lastName || !dateOfBirthRaw) {
          errors.push({
            row: rowNumber,
            message: "Missing required field (firstName, lastName, dateOfBirth)",
          });
          continue;
        }
        const dateOfBirth = new Date(dateOfBirthRaw);
        if (Number.isNaN(dateOfBirth.getTime())) {
          errors.push({ row: rowNumber, message: `Invalid dateOfBirth "${dateOfBirthRaw}"` });
          continue;
        }
        if (gender && !(GENDER_OPTIONS as readonly string[]).includes(gender)) {
          errors.push({
            row: rowNumber,
            message: `Invalid gender "${gender}" — must be one of ${GENDER_OPTIONS.join(", ")}`,
          });
          continue;
        }
        if (studentCode && seenCodes.has(studentCode)) {
          errors.push({ row: rowNumber, message: `Duplicate studentCode "${studentCode}" within this file` });
          continue;
        }

        const existing = studentCode ? existingByCode.get(studentCode) : undefined;
        if (studentCode && existing) {
          // Update path — a filled studentCode that matches a real
          // student updates it, it never silently falls through to
          // create-a-duplicate. Skipped entirely if the row is byte-for-
          // byte what's already stored — a re-sync of a large roster
          // where only a few rows actually changed shouldn't write the
          // rest back unchanged.
          const unchanged =
            existing.firstName === firstName &&
            existing.lastName === lastName &&
            existing.dateOfBirth.toISOString().slice(0, 10) === dateOfBirthRaw &&
            (existing.gender ?? "") === (gender ?? "");
          if (!unchanged) {
            await tx.student.update({
              where: { id: existing.id },
              data: { firstName, lastName, dateOfBirth, gender },
            });
          }
          seenCodes.add(studentCode);
          updated++;
          continue;
        }
        if (studentCode && !existing) {
          errors.push({ row: rowNumber, message: `studentCode "${studentCode}" does not match any existing student` });
          continue;
        }

        // Blank studentCode — a new student, same auto-generated-code
        // path createStudent already uses.
        if (combinedCount >= limit) {
          errors.push({
            row: rowNumber,
            message: `${organization?.edition} edition's ${limit}-record limit reached — upgrade to import more`,
          });
          continue;
        }
        const newStudentCode = await this.nextStudentCode(tx, organizationId);
        await tx.student.create({
          data: { organizationId, studentCode: newStudentCode, firstName, lastName, dateOfBirth, gender },
        });
        combinedCount++;
        created++;
      }
    });

    return { totalRows: records.length, created, updated, errors };
  }

  private static readonly IMPORT_COLUMNS: ColumnSpec[] = [
    { key: "studentCode", header: "studentCode", width: 16, note: "Leave blank for a new student — filled in automatically. Fill in to update that existing student." },
    { key: "firstName", header: "firstName", width: 18 },
    { key: "lastName", header: "lastName", width: 18 },
    { key: "dateOfBirth", header: "dateOfBirth", width: 16, note: "Format: YYYY-MM-DD (e.g. 2015-06-30)" },
    {
      key: "gender",
      header: "gender",
      width: 12,
      note: `Pick one from the dropdown: ${GENDER_OPTIONS.join(", ")}`,
      dropdownOptions: [...GENDER_OPTIONS],
    },
  ];

  // Downloadable starting point for a bulk import — a blank version of
  // importStudents' own columns, Gender constrained to GENDER_OPTIONS via
  // Excel's native in-cell dropdown so data entered against it already
  // matches what the server will accept instead of failing per-row after
  // the fact.
  async generateImportTemplate(): Promise<Buffer> {
    return buildWorkbook("Students", StudentsService.IMPORT_COLUMNS, []);
  }

  // The other half of the round trip: the same template, pre-filled with
  // every current student (studentCode included, so re-uploading this
  // exact file after editing it updates those rows instead of rejecting
  // them as duplicates). Download, edit in Excel, re-import via
  // importStudents, repeat.
  async exportEditableStudents(organizationId: string): Promise<Buffer> {
    const students = await this.prisma.withTenant(organizationId, (tx) =>
      tx.student.findMany({ where: { organizationId, deletedAt: null }, orderBy: { studentCode: "asc" } }),
    );
    const rows = students.map((s) => ({
      studentCode: s.studentCode,
      firstName: s.firstName,
      lastName: s.lastName,
      dateOfBirth: s.dateOfBirth.toISOString().slice(0, 10),
      gender: s.gender ?? "",
    }));
    return buildWorkbook("Students", StudentsService.IMPORT_COLUMNS, rows);
  }

  async exportStudentsCsv(organizationId: string): Promise<string> {
    const students = await this.prisma.withTenant(organizationId, (tx) =>
      tx.student.findMany({ where: { organizationId, deletedAt: null }, orderBy: { studentCode: "asc" } }),
    );
    const header = "studentCode,firstName,lastName,dateOfBirth,gender,status";
    const rows = students.map((s) =>
      [
        s.studentCode,
        s.firstName,
        s.lastName,
        s.dateOfBirth.toISOString().slice(0, 10),
        s.gender ?? "",
        s.status,
      ]
        .map(csvEscape)
        .join(","),
    );
    return [header, ...rows].join("\n");
  }
}

function csvEscape(field: string): string {
  if (/[",\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
