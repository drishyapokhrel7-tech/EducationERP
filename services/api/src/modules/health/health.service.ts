import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { UpdateHealthProfileDto } from "./dto/update-health-profile.dto";
import { CreateHealthVisitDto } from "./dto/create-health-visit.dto";
import { UpdateHealthVisitDto } from "./dto/update-health-visit.dto";
import { ListHealthVisitsQueryDto } from "./dto/list-health-visits.dto";
import { paginate } from "../../common/pagination";

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
}
