import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { parse } from "csv-parse/sync";
import { PrismaService } from "../../prisma/prisma.service";
import { UpdateHealthProfileDto } from "./dto/update-health-profile.dto";
import { CreateHealthVisitDto } from "./dto/create-health-visit.dto";
import { UpdateHealthVisitDto } from "./dto/update-health-visit.dto";
import { ListHealthVisitsQueryDto } from "./dto/list-health-visits.dto";
import { ImportResult, ImportRowError } from "./dto/import-result.dto";
import { paginate } from "../../common/pagination";
import { buildWorkbook, parseWorkbookRows, type ColumnSpec } from "../../common/excel-sync";

const YES_NO_OPTIONS = ["Yes", "No"];

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireStudent(tx: PrismaClient, organizationId: string, studentId: string) {
    const student = await tx.student.findUnique({ where: { id: studentId } });
    if (!student || student.organizationId !== organizationId) throw new NotFoundException("Student not found");
    return student;
  }

  async getHealthProfile(organizationId: string, studentId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.requireStudent(tx, organizationId, studentId);
      return tx.studentHealthProfile.findUnique({ where: { studentId } });
    });
  }

  // Upsert, not create — a health profile is one row per student edited
  // in place (see the schema comment on StudentHealthProfile), so the
  // frontend never needs to know whether one already exists yet.
  async updateHealthProfile(organizationId: string, studentId: string, dto: UpdateHealthProfileDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.requireStudent(tx, organizationId, studentId);
      return tx.studentHealthProfile.upsert({
        where: { studentId },
        update: dto,
        create: { organizationId, studentId, ...dto },
      });
    });
  }

  async listHealthVisits(organizationId: string, studentId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.requireStudent(tx, organizationId, studentId);
      return tx.healthVisit.findMany({
        where: { organizationId, studentId },
        // Narrowed select, not include: true — a full User row carries
        // passwordHash, never safe to return over the API (same
        // reasoning as DisciplineService's reportedBy include).
        include: { recordedBy: { select: { firstName: true, lastName: true } } },
        orderBy: { visitDate: "desc" },
      });
    });
  }

  async createHealthVisit(organizationId: string, studentId: string, recordedByUserId: string, dto: CreateHealthVisitDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.requireStudent(tx, organizationId, studentId);
      return tx.healthVisit.create({
        data: {
          organizationId,
          studentId,
          recordedByUserId,
          visitDate: new Date(dto.visitDate),
          reason: dto.reason,
          treatmentGiven: dto.treatmentGiven,
          referredExternally: dto.referredExternally ?? false,
        },
      });
    });
  }

  // Org-wide, filterable, paginated — mirrors listAllIncidents' shape.
  listAllHealthVisits(organizationId: string, filters: ListHealthVisitsQueryDto) {
    return this.prisma.withTenant(organizationId, (tx) => {
      const where = {
        organizationId,
        ...(filters.studentId ? { studentId: filters.studentId } : {}),
      };
      return paginate(
        () =>
          tx.healthVisit.findMany({
            where,
            include: { student: true, recordedBy: { select: { firstName: true, lastName: true } } },
            orderBy: { visitDate: "desc" },
            skip: ((filters.page ?? 1) - 1) * (filters.pageSize ?? 25),
            take: filters.pageSize ?? 25,
          }),
        () => tx.healthVisit.count({ where }),
        filters.page ?? 1,
        filters.pageSize ?? 25,
      );
    });
  }

  async updateHealthVisit(organizationId: string, id: string, dto: UpdateHealthVisitDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const visit = await tx.healthVisit.findUnique({ where: { id } });
      if (!visit || visit.organizationId !== organizationId) throw new NotFoundException("Health visit not found");
      return tx.healthVisit.update({
        where: { id },
        data: {
          visitDate: dto.visitDate ? new Date(dto.visitDate) : undefined,
          reason: dto.reason,
          treatmentGiven: dto.treatmentGiven,
          referredExternally: dto.referredExternally,
        },
      });
    });
  }

  async deleteHealthVisit(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const visit = await tx.healthVisit.findUnique({ where: { id } });
      if (!visit || visit.organizationId !== organizationId) throw new NotFoundException("Health visit not found");
      await tx.healthVisit.delete({ where: { id } });
      return { deleted: true };
    });
  }

  // ── Excel round trip ────────────────────────────────────────────────
  //
  // Same buildWorkbook/parseWorkbookRows round trip as
  // DisciplineService's own visit-log-shaped import — id (blank for
  // new, filled from an export to update) is the row's identity, and
  // each row carries its own studentCode since this spans many
  // students in one org-wide file.

  private static readonly IMPORT_COLUMNS: ColumnSpec[] = [
    { key: "id", header: "id", width: 24, note: "Leave blank for a new visit. Fill in (from an export) to update that visit instead." },
    { key: "studentCode", header: "studentCode", width: 16 },
    { key: "visitDate", header: "visitDate", width: 14, note: "Format: YYYY-MM-DD" },
    { key: "reason", header: "reason", width: 30 },
    { key: "treatmentGiven", header: "treatmentGiven", width: 30 },
    { key: "referredExternally", header: "referredExternally", width: 16, note: "Yes or No", dropdownOptions: YES_NO_OPTIONS },
  ];

  async generateVisitImportTemplate(): Promise<Buffer> {
    return buildWorkbook("Health Visits", HealthService.IMPORT_COLUMNS, []);
  }

  async exportEditableVisits(organizationId: string): Promise<Buffer> {
    const visits = await this.prisma.withTenant(organizationId, (tx) =>
      tx.healthVisit.findMany({ where: { organizationId }, include: { student: true }, orderBy: { visitDate: "desc" } }),
    );
    const rows = visits.map((v) => ({
      id: v.id,
      studentCode: v.student.studentCode,
      visitDate: v.visitDate.toISOString().slice(0, 10),
      reason: v.reason,
      treatmentGiven: v.treatmentGiven ?? "",
      referredExternally: v.referredExternally ? "Yes" : "No",
    }));
    return buildWorkbook("Health Visits", HealthService.IMPORT_COLUMNS, rows);
  }

  async importVisits(organizationId: string, recordedByUserId: string, fileBuffer: Buffer, originalName: string): Promise<ImportResult> {
    let records: Record<string, string>[];
    if (/\.xlsx$/i.test(originalName)) {
      try {
        records = await parseWorkbookRows(fileBuffer);
      } catch (err) {
        throw new BadRequestException((err as Error).message);
      }
    } else {
      try {
        records = parse(fileBuffer, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
      } catch (err) {
        throw new BadRequestException(`Could not parse CSV: ${(err as Error).message}`);
      }
    }

    const errors: ImportRowError[] = [];
    let created = 0;
    let updated = 0;

    await this.prisma.withTenant(organizationId, async (tx) => {
      const [studentsByCode, existingById] = await Promise.all([
        tx.student.findMany({ where: { organizationId }, select: { id: true, studentCode: true } }).then((rows) => new Map(rows.map((s) => [s.studentCode, s.id]))),
        tx.healthVisit.findMany({ where: { organizationId } }).then((rows) => new Map(rows.map((v) => [v.id, v]))),
      ]);

      for (let i = 0; i < records.length; i++) {
        const rowNumber = i + 2;
        const row = records[i];
        const id = row.id?.trim() || undefined;
        const studentCode = row.studentCode?.trim();
        const visitDateRaw = row.visitDate?.trim();
        const reason = row.reason?.trim();
        const treatmentGiven = row.treatmentGiven?.trim() || undefined;
        const referredRaw = row.referredExternally?.trim();

        if (!studentCode || !visitDateRaw || !reason) {
          errors.push({ row: rowNumber, message: "Missing required field (studentCode, visitDate, reason)" });
          continue;
        }
        const studentId = studentsByCode.get(studentCode);
        if (!studentId) {
          errors.push({ row: rowNumber, message: `studentCode "${studentCode}" does not match any existing student` });
          continue;
        }
        const visitDate = new Date(visitDateRaw);
        if (Number.isNaN(visitDate.getTime())) {
          errors.push({ row: rowNumber, message: `Invalid visitDate "${visitDateRaw}"` });
          continue;
        }
        if (referredRaw && !YES_NO_OPTIONS.includes(referredRaw)) {
          errors.push({ row: rowNumber, message: `Invalid referredExternally "${referredRaw}" — must be Yes or No` });
          continue;
        }
        const referredExternally = referredRaw === "Yes";

        if (id) {
          const existing = existingById.get(id);
          if (!existing) {
            errors.push({ row: rowNumber, message: `id "${id}" does not match any existing visit` });
            continue;
          }
          await tx.healthVisit.update({
            where: { id },
            data: { studentId, visitDate, reason, treatmentGiven, referredExternally },
          });
          updated++;
        } else {
          await tx.healthVisit.create({
            data: { organizationId, studentId, recordedByUserId, visitDate, reason, treatmentGiven, referredExternally },
          });
          created++;
        }
      }
    });

    return { totalRows: records.length, created, updated, errors };
  }
}
