import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { parse } from "csv-parse/sync";
import * as argon2 from "argon2";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateStudentDto } from "./dto/create-student.dto";
import { CreateGuardianDto } from "./dto/create-guardian.dto";
import { AttachGuardianDto } from "./dto/attach-guardian.dto";
import { CreateEnrollmentDto } from "./dto/create-enrollment.dto";
import { UpdateStudentStatusDto } from "./dto/update-student-status.dto";
import { CreateStudentLoginDto } from "./dto/create-student-login.dto";
import { ImportResult, ImportRowError } from "./dto/import-result.dto";
import { assertUnderEditionLimit, editionLimit } from "../organizations/edition-limits";
import { paginate } from "../../common/pagination";

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
        select: { id: true, firstName: true, lastName: true, studentCode: true, status: true },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
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
  private async nextStudentCode(tx: PrismaClient, organizationId: string): Promise<string> {
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

  listGuardians(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.guardian.findMany({
        where: { organizationId },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      }),
    );
  }

  createGuardian(organizationId: string, dto: CreateGuardianDto) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.guardian.create({
        data: {
          organizationId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          email: dto.email,
          occupation: dto.occupation,
          photoUrl: dto.photoUrl,
        },
      }),
    );
  }

  private async requireStudent(organizationId: string, studentId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const student = await tx.student.findUnique({ where: { id: studentId } });
      if (!student) throw new NotFoundException("Student not found");
      return student;
    });
  }

  async attachGuardian(organizationId: string, studentId: string, dto: AttachGuardianDto) {
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
        include: { program: true, section: true, term: true },
      }),
    );
  }

  async createEnrollment(organizationId: string, studentId: string, dto: CreateEnrollmentDto) {
    await this.requireStudent(organizationId, studentId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      const [program, section, term] = await Promise.all([
        tx.program.findUnique({ where: { id: dto.programId } }),
        tx.section.findUnique({ where: { id: dto.sectionId } }),
        tx.term.findUnique({ where: { id: dto.termId } }),
      ]);
      if (!program) throw new NotFoundException("Program not found");
      if (!section) throw new NotFoundException("Section not found");
      if (!term) throw new NotFoundException("Term not found");

      return tx.studentEnrollment.create({
        data: {
          organizationId,
          studentId,
          programId: dto.programId,
          sectionId: dto.sectionId,
          termId: dto.termId,
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
  async importStudents(organizationId: string, csvBuffer: Buffer): Promise<ImportResult> {
    let records: Record<string, string>[];
    try {
      // csv-parse's `parse()` return type is untyped `any` regardless of
      // input (checked the .d.ts — no generic support in this version);
      // the cast documents the shape `columns: true` actually produces.
      records = parse(csvBuffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Record<string, string>[];
    } catch (err) {
      throw new BadRequestException(`Could not parse CSV: ${(err as Error).message}`);
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
      const limit = organization ? editionLimit(organization.edition) : null;
      let combinedCount = 0;
      if (limit !== null) {
        const [activeStudentCount, activeEmployeeCount] = await Promise.all([
          tx.student.count({ where: { organizationId, deletedAt: null } }),
          tx.employee.count({ where: { organizationId, deletedAt: null } }),
        ]);
        combinedCount = activeStudentCount + activeEmployeeCount;
      }

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
        if (seenCodes.has(studentCode)) {
          errors.push({ row: rowNumber, message: `Duplicate studentCode "${studentCode}" within this file` });
          continue;
        }
        if (existingCodes.has(studentCode)) {
          errors.push({ row: rowNumber, message: `studentCode "${studentCode}" already exists` });
          continue;
        }
        if (limit !== null && combinedCount >= limit) {
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
