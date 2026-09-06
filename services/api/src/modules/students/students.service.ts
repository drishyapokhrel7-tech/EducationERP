import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { parse } from "csv-parse/sync";
import * as argon2 from "argon2";
import * as ExcelJS from "exceljs";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateStudentDto } from "./dto/create-student.dto";
import { UpdateStudentDto } from "./dto/update-student.dto";
import { CreateGuardianDto } from "./dto/create-guardian.dto";
import { UpdateGuardianDto } from "./dto/update-guardian.dto";
import { AttachGuardianDto } from "./dto/attach-guardian.dto";
import { CreateEnrollmentDto } from "./dto/create-enrollment.dto";
import { ListEnrollmentsQueryDto } from "./dto/list-enrollments.dto";
import { UpdateEnrollmentStatusDto } from "./dto/update-enrollment-status.dto";
import { UpdateStudentStatusDto } from "./dto/update-student-status.dto";
import { CreateStudentLoginDto } from "./dto/create-student-login.dto";
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
  listStudentsPicker(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.student.findMany({
        where: { organizationId, deletedAt: null },
        select: {
          id: true,
          userId: true,
          firstName: true,
          middleName: true,
          lastName: true,
          studentCode: true,
          status: true,
        },
        orderBy: [{ firstName: "asc" }, { middleName: "asc" }, { lastName: "asc" }],
      }),
    );
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
   * Parses in-memory, never persists the file — the object-storage
   * backend for real document uploads is still an open decision (see
   * PHASE_1_NOTES.md); a transient parse-then-discard CSV import doesn't
   * need it. Invalid/duplicate rows are skipped and reported, not fatal
   * to the whole batch — "rollback where practical" (plan §19) applied
   * per-row, since each row is a single independent insert.
   */
  async importStudents(organizationId: string, fileBuffer: Buffer, originalName: string): Promise<ImportResult> {
    // Accepts the .xlsx template (download it via generateImportTemplate)
    // as well as plain CSV — decided by extension, not content-sniffing,
    // since a valid CSV can't be told apart from garbage by trying to
    // parse it as xlsx first. Both paths converge on the same
    // Record<string,string>[] shape the row-validation loop below
    // already expects, so nothing past this point needs to know which
    // format the file came in as.
    let records: Record<string, string>[];
    if (/\.xlsx$/i.test(originalName)) {
      records = await this.parseXlsxRows(fileBuffer);
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

    await this.prisma.withTenant(organizationId, async (tx) => {
      // One upfront read instead of a per-row findFirst — the whole
      // batch runs inside this single transaction, so no concurrent
      // write can appear between here and the loop below. A per-row
      // round trip is what previously blew the 15s transaction
      // timeout on a 76-row file under ordinary Neon latency.
      const existingRows = await tx.student.findMany({
        where: { organizationId },
        select: { studentCode: true },
      });
      const existingCodes = new Set(existingRows.map((s) => s.studentCode));
      const seenCodes = new Set<string>();

      // Same licensing cap as the single-record createStudent path —
      // a CSV import is just another way to add student records, so
      // it needs the same gate, not a bypass. Checked once up front
      // (edition + current combined count) and tracked as a running
      // total per successful row, rather than a fresh query per row,
      // for the same "one transaction, no N round trips" reasoning
      // already documented above for existingCodes.
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

        if (!studentCode || !firstName || !lastName || !dateOfBirthRaw) {
          errors.push({
            row: rowNumber,
            message: "Missing required field (studentCode, firstName, lastName, dateOfBirth)",
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
        if (seenCodes.has(studentCode)) {
          errors.push({ row: rowNumber, message: `Duplicate studentCode "${studentCode}" within this file` });
          continue;
        }
        if (existingCodes.has(studentCode)) {
          errors.push({ row: rowNumber, message: `studentCode "${studentCode}" already exists` });
          continue;
        }
        if (combinedCount >= limit) {
          errors.push({
            row: rowNumber,
            message: `${organization?.edition} edition's ${limit}-record limit reached — upgrade to import more`,
          });
          continue;
        }

        await tx.student.create({
          data: { organizationId, studentCode, firstName, lastName, dateOfBirth, gender },
        });
        seenCodes.add(studentCode);
        combinedCount++;
        created++;
      }
    });

    return { totalRows: records.length, created, errors };
  }

  // Reads the first worksheet's header row as column names (same
  // `columns: true` shape csv-parse already produces), so the row-
  // validation loop above needs no branching for where its input came
  // from. Blank trailing rows (common when a template's unused rows
  // still carry the gender dropdown's data-validation formatting)
  // are skipped, not treated as empty records.
  private async parseXlsxRows(buffer: Buffer): Promise<Record<string, string>[]> {
    const workbook = new ExcelJS.Workbook();
    try {
      // exceljs's .d.ts wants a plain Buffer; the generic parameter TS
      // infers for a Multer-sourced buffer doesn't structurally match
      // even though it's a real Buffer at runtime — same class of
      // @types/node generic mismatch already worked around elsewhere
      // in this codebase (pdfkit/argon2 imports), not a real type
      // error.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument -- see comment above
      await workbook.xlsx.load(buffer as any);
    } catch (err) {
      throw new BadRequestException(`Could not parse Excel file: ${(err as Error).message}`);
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException("The uploaded workbook has no sheets");

    const headerRow = sheet.getRow(1);
    const columns: string[] = [];
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      columns[colNumber] = cellValueToString(cell.value).trim();
    });

    const records: Record<string, string>[] = [];
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const record: Record<string, string> = {};
      let hasAnyValue = false;
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const key = columns[colNumber];
        if (!key) return;
        const raw = cell.value;
        // Excel stores a real Date object for date-formatted cells,
        // not a string — normalize to the same YYYY-MM-DD the CSV
        // path and CreateStudentDto's @IsDateString both expect.
        const value = raw instanceof Date ? raw.toISOString().slice(0, 10) : cellValueToString(raw).trim();
        if (value) hasAnyValue = true;
        record[key] = value;
      });
      if (hasAnyValue) records.push(record);
    }
    return records;
  }

  // Downloadable starting point for a bulk import — same columns
  // importStudents expects, a Gender column constrained to
  // GENDER_OPTIONS via Excel's native in-cell dropdown (Data
  // Validation), so data entered against the template already matches
  // what the server will accept instead of failing per-row after the
  // fact. Applied to a generous 500 data rows, not just the visible
  // ones, so pasting/filling further down still gets the dropdown.
  async generateImportTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Students");
    const headers = ["studentCode", "firstName", "lastName", "dateOfBirth", "gender"];
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
    sheet.columns = [
      { width: 16 }, // studentCode
      { width: 18 }, // firstName
      { width: 18 }, // lastName
      { width: 16 }, // dateOfBirth
      { width: 12 }, // gender
    ];
    sheet.getCell("D1").note = "Format: YYYY-MM-DD (e.g. 2015-06-30)";
    sheet.getCell("E1").note = `Pick one from the dropdown: ${GENDER_OPTIONS.join(", ")}`;

    const genderColumn = 5; // "E"
    const firstDataRow = 2;
    const lastDataRow = 501;
    for (let rowNumber = firstDataRow; rowNumber <= lastDataRow; rowNumber++) {
      sheet.getCell(rowNumber, genderColumn).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${GENDER_OPTIONS.join(",")}"`],
        showErrorMessage: true,
        errorStyle: "error",
        errorTitle: "Invalid gender",
        error: `Please pick one of: ${GENDER_OPTIONS.join(", ")}`,
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
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

// ExcelJS.CellValue is a union that includes rich-text/formula/
// hyperlink object shapes alongside plain string/number/boolean/Date
// — a naive String(value) on one of those objects would silently
// stringify to "[object Object]". The import template only ever puts
// plain text/dates in its cells, so this only needs to handle the
// common cases honestly and fall back to "" for anything else, rather
// than risk that silent garbage value reaching a student record.
function cellValueToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object" && "text" in value && typeof value.text === "string") return value.text;
  if (typeof value === "object" && "result" in value && typeof value.result === "string") return value.result;
  return "";
}
