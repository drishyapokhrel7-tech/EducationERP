import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient, DisciplineSeverity } from "@prisma/client";
import { parse } from "csv-parse/sync";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateIncidentTypeDto } from "./dto/create-incident-type.dto";
import { UpdateIncidentTypeDto } from "./dto/update-incident-type.dto";
import { CreateIncidentDto } from "./dto/create-incident.dto";
import { UpdateIncidentDto } from "./dto/update-incident.dto";
import { ListIncidentsQueryDto } from "./dto/list-incidents.dto";
import { ImportResult, ImportRowError } from "./dto/import-result.dto";
import { paginate } from "../../common/pagination";
import { buildWorkbook, parseWorkbookRows, type ColumnSpec } from "../../common/excel-sync";

const SEVERITY_OPTIONS = Object.values(DisciplineSeverity);

@Injectable()
export class DisciplineService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireStudent(tx: PrismaClient, organizationId: string, studentId: string) {
    const student = await tx.student.findUnique({ where: { id: studentId } });
    if (!student || student.organizationId !== organizationId) throw new NotFoundException("Student not found");
    return student;
  }

  async listIncidents(organizationId: string, studentId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.requireStudent(tx, organizationId, studentId);
      return tx.disciplineIncident.findMany({
        where: { organizationId, studentId },
        // Narrowed select, not include: true — a full User row carries
        // passwordHash (see commit 2a92f81's sweep for this same
        // pattern), never safe to return over the API.
        include: { reportedBy: { select: { firstName: true, lastName: true } } },
        orderBy: { incidentDate: "desc" },
      });
    });
  }

  async createIncident(organizationId: string, studentId: string, reportedByUserId: string, dto: CreateIncidentDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.requireStudent(tx, organizationId, studentId);
      return tx.disciplineIncident.create({
        data: {
          organizationId,
          studentId,
          reportedByUserId,
          incidentType: dto.incidentType,
          severity: dto.severity,
          description: dto.description,
          actionTaken: dto.actionTaken,
          incidentDate: new Date(dto.incidentDate),
        },
      });
    });
  }

  // Org-wide, filterable, paginated — mirrors listAllActivities/
  // listAllEnrollments' own shape.
  listAllIncidents(organizationId: string, filters: ListIncidentsQueryDto) {
    return this.prisma.withTenant(organizationId, (tx) => {
      const where = {
        organizationId,
        ...(filters.studentId ? { studentId: filters.studentId } : {}),
        ...(filters.severity ? { severity: filters.severity } : {}),
      };
      return paginate(
        () =>
          tx.disciplineIncident.findMany({
            where,
            include: { student: true, reportedBy: { select: { firstName: true, lastName: true } } },
            orderBy: { incidentDate: "desc" },
            skip: ((filters.page ?? 1) - 1) * (filters.pageSize ?? 25),
            take: filters.pageSize ?? 25,
          }),
        () => tx.disciplineIncident.count({ where }),
        filters.page ?? 1,
        filters.pageSize ?? 25,
      );
    });
  }

  async updateIncident(organizationId: string, id: string, dto: UpdateIncidentDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const incident = await tx.disciplineIncident.findUnique({ where: { id } });
      if (!incident || incident.organizationId !== organizationId) throw new NotFoundException("Incident not found");
      return tx.disciplineIncident.update({
        where: { id },
        data: {
          incidentType: dto.incidentType,
          severity: dto.severity,
          description: dto.description,
          actionTaken: dto.actionTaken,
          incidentDate: dto.incidentDate ? new Date(dto.incidentDate) : undefined,
        },
      });
    });
  }

  async deleteIncident(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const incident = await tx.disciplineIncident.findUnique({ where: { id } });
      if (!incident || incident.organizationId !== organizationId) throw new NotFoundException("Incident not found");
      await tx.disciplineIncident.delete({ where: { id } });
      return { deleted: true };
    });
  }

  // Upsert-by-name, same reasoning as every other lookup catalog in this
  // app (HostelLookup/ExtracurricularActivityLookup) — the frontend's
  // inline "+ Add new" flow can safely re-submit an already-listed value.
  createIncidentType(organizationId: string, dto: CreateIncidentTypeDto) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.disciplineIncidentType.upsert({
        where: { organizationId_name: { organizationId, name: dto.name } },
        update: {},
        create: { organizationId, name: dto.name },
      }),
    );
  }

  listIncidentTypes(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.disciplineIncidentType.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    );
  }

  async updateIncidentType(organizationId: string, id: string, dto: UpdateIncidentTypeDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadIncidentType(tx, organizationId, id);
      return tx.disciplineIncidentType.update({ where: { id }, data: dto });
    });
  }

  // No assertNoDependents here, deliberately — DisciplineIncident.
  // incidentType stores a plain string, not an FK, so removing a
  // catalog entry never orphans or blocks deleting historical incidents.
  async deleteIncidentType(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadIncidentType(tx, organizationId, id);
      await tx.disciplineIncidentType.delete({ where: { id } });
      return { deleted: true };
    });
  }

  private async loadIncidentType(tx: PrismaClient, organizationId: string, id: string) {
    const type = await tx.disciplineIncidentType.findUnique({ where: { id } });
    if (!type || type.organizationId !== organizationId) throw new NotFoundException("Incident type not found");
    return type;
  }

  // ── Excel round trip ────────────────────────────────────────────────
  //
  // Same buildWorkbook/parseWorkbookRows round trip as
  // StudentsService.importStudents, with the same "id, not a
  // human-assigned code, is the update-vs-create key" shape
  // StudentsService.importActivities uses — an incident has no natural
  // code of its own. Each row also carries its own studentCode to
  // resolve which student it belongs to, since this is an org-wide
  // import spanning many students in one file.

  private async buildIncidentImportColumns(organizationId: string): Promise<ColumnSpec[]> {
    const types = await this.prisma.withTenant(organizationId, (tx) =>
      tx.disciplineIncidentType.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    );
    return [
      { key: "id", header: "id", width: 24, note: "Leave blank for a new incident. Fill in (from an export) to update that incident instead." },
      { key: "studentCode", header: "studentCode", width: 16 },
      { key: "incidentType", header: "incidentType", width: 20, dropdownOptions: types.map((t) => t.name) },
      { key: "severity", header: "severity", width: 12, note: `One of: ${SEVERITY_OPTIONS.join(", ")}`, dropdownOptions: [...SEVERITY_OPTIONS] },
      { key: "description", header: "description", width: 30 },
      { key: "actionTaken", header: "actionTaken", width: 25 },
      { key: "incidentDate", header: "incidentDate", width: 14, note: "Format: YYYY-MM-DD" },
    ];
  }

  async generateIncidentImportTemplate(organizationId: string): Promise<Buffer> {
    const columns = await this.buildIncidentImportColumns(organizationId);
    return buildWorkbook("Incidents", columns, []);
  }

  async exportEditableIncidents(organizationId: string): Promise<Buffer> {
    const [columns, incidents] = await Promise.all([
      this.buildIncidentImportColumns(organizationId),
      this.prisma.withTenant(organizationId, (tx) =>
        tx.disciplineIncident.findMany({ where: { organizationId }, include: { student: true }, orderBy: { incidentDate: "desc" } }),
      ),
    ]);
    const rows = incidents.map((i) => ({
      id: i.id,
      studentCode: i.student.studentCode,
      incidentType: i.incidentType,
      severity: i.severity,
      description: i.description,
      actionTaken: i.actionTaken ?? "",
      incidentDate: i.incidentDate.toISOString().slice(0, 10),
    }));
    return buildWorkbook("Incidents", columns, rows);
  }

  async importIncidents(organizationId: string, reportedByUserId: string, fileBuffer: Buffer, originalName: string): Promise<ImportResult> {
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
        tx.disciplineIncident.findMany({ where: { organizationId } }).then((rows) => new Map(rows.map((i) => [i.id, i]))),
      ]);

      for (let i = 0; i < records.length; i++) {
        const rowNumber = i + 2;
        const row = records[i];
        const id = row.id?.trim() || undefined;
        const studentCode = row.studentCode?.trim();
        const incidentType = row.incidentType?.trim();
        const severityRaw = row.severity?.trim();
        const description = row.description?.trim();
        const actionTaken = row.actionTaken?.trim() || undefined;
        const incidentDateRaw = row.incidentDate?.trim();

        if (!studentCode || !incidentType || !severityRaw || !description || !incidentDateRaw) {
          errors.push({ row: rowNumber, message: "Missing required field (studentCode, incidentType, severity, description, incidentDate)" });
          continue;
        }
        const studentId = studentsByCode.get(studentCode);
        if (!studentId) {
          errors.push({ row: rowNumber, message: `studentCode "${studentCode}" does not match any existing student` });
          continue;
        }
        if (!(SEVERITY_OPTIONS as readonly string[]).includes(severityRaw)) {
          errors.push({ row: rowNumber, message: `Invalid severity "${severityRaw}" — must be one of ${SEVERITY_OPTIONS.join(", ")}` });
          continue;
        }
        const severity = severityRaw as DisciplineSeverity;
        const incidentDate = new Date(incidentDateRaw);
        if (Number.isNaN(incidentDate.getTime())) {
          errors.push({ row: rowNumber, message: `Invalid incidentDate "${incidentDateRaw}"` });
          continue;
        }

        if (id) {
          const existing = existingById.get(id);
          if (!existing) {
            errors.push({ row: rowNumber, message: `id "${id}" does not match any existing incident` });
            continue;
          }
          await tx.disciplineIncident.update({
            where: { id },
            data: { studentId, incidentType, severity, description, actionTaken, incidentDate },
          });
          updated++;
        } else {
          await tx.disciplineIncident.create({
            data: { organizationId, studentId, reportedByUserId, incidentType, severity, description, actionTaken, incidentDate },
          });
          created++;
        }
      }
    });

    return { totalRows: records.length, created, updated, errors };
  }
}
