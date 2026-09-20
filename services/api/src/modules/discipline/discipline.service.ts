import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateIncidentTypeDto } from "./dto/create-incident-type.dto";
import { UpdateIncidentTypeDto } from "./dto/update-incident-type.dto";
import { CreateIncidentDto } from "./dto/create-incident.dto";
import { UpdateIncidentDto } from "./dto/update-incident.dto";
import { ListIncidentsQueryDto } from "./dto/list-incidents.dto";
import { paginate } from "../../common/pagination";

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
}
