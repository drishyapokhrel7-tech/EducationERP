import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { parse } from "csv-parse/sync";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateStudentDto } from "./dto/create-student.dto";
import { CreateGuardianDto } from "./dto/create-guardian.dto";
import { AttachGuardianDto } from "./dto/attach-guardian.dto";
import { CreateEnrollmentDto } from "./dto/create-enrollment.dto";
import { UpdateStudentStatusDto } from "./dto/update-student-status.dto";
import { ImportResult, ImportRowError } from "./dto/import-result.dto";

/** Same load-bearing parent-guard pattern as every prior slice's service. */
@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  listStudents(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.student.findMany({
        where: { organizationId, deletedAt: null },
        include: { guardians: { include: { guardian: true } } },
      }),
    );
  }

  createStudent(organizationId: string, dto: CreateStudentDto) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.student.create({
        data: {
          organizationId,
          studentCode: dto.studentCode,
          firstName: dto.firstName,
          lastName: dto.lastName,
          dateOfBirth: new Date(dto.dateOfBirth),
          gender: dto.gender,
        },
      }),
    );
  }

  listGuardians(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.guardian.findMany({ where: { organizationId } }),
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
    const seenCodes = new Set<string>();
    let created = 0;

    await this.prisma.withTenant(organizationId, async (tx) => {
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
        const existing = await tx.student.findFirst({ where: { organizationId, studentCode } });
        if (existing) {
          errors.push({ row: rowNumber, message: `studentCode "${studentCode}" already exists` });
          continue;
        }

        await tx.student.create({
          data: { organizationId, studentCode, firstName, lastName, dateOfBirth, gender },
        });
        seenCodes.add(studentCode);
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
