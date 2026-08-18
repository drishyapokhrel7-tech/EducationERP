import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateStaffTypeDto } from "./dto/create-staff-type.dto";
import { CreateDesignationDto } from "./dto/create-designation.dto";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { CreateEmploymentHistoryDto } from "./dto/create-employment-history.dto";
import { CreateQualificationDto } from "./dto/create-qualification.dto";
import { UpsertTeacherProfileDto } from "./dto/upsert-teacher-profile.dto";

/**
 * Same load-bearing pattern as org-structure.service.ts: every create*
 * that takes a parent/reference id (departmentId, staffTypeId,
 * designationId, employeeId, ...) validates it belongs to the caller's
 * org via an RLS-scoped lookup first — Postgres FK checks alone would
 * let a cross-tenant reference through, since they check raw table
 * existence, not RLS-filtered visibility.
 */
@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  listStaffTypes(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.staffType.findMany({ where: { organizationId } }),
    );
  }

  createStaffType(organizationId: string, dto: CreateStaffTypeDto) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.staffType.create({ data: { organizationId, name: dto.name, code: dto.code } }),
    );
  }

  listDesignations(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.designation.findMany({ where: { organizationId } }),
    );
  }

  createDesignation(organizationId: string, dto: CreateDesignationDto) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.designation.create({ data: { organizationId, name: dto.name, code: dto.code } }),
    );
  }

  listEmployees(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.employee.findMany({
        where: { organizationId, deletedAt: null },
        include: { staffType: true, designation: true, department: true },
      }),
    );
  }

  async createEmployee(organizationId: string, dto: CreateEmployeeDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const [staffType, designation, department] = await Promise.all([
        tx.staffType.findUnique({ where: { id: dto.staffTypeId } }),
        tx.designation.findUnique({ where: { id: dto.designationId } }),
        dto.departmentId ? tx.department.findUnique({ where: { id: dto.departmentId } }) : null,
      ]);
      if (!staffType) throw new NotFoundException("Staff type not found");
      if (!designation) throw new NotFoundException("Designation not found");
      if (dto.departmentId && !department) throw new NotFoundException("Department not found");

      return tx.employee.create({
        data: {
          organizationId,
          staffTypeId: dto.staffTypeId,
          designationId: dto.designationId,
          departmentId: dto.departmentId,
          employeeCode: dto.employeeCode,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          dateOfJoining: new Date(dto.dateOfJoining),
        },
      });
    });
  }

  private async requireEmployee(organizationId: string, employeeId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const employee = await tx.employee.findUnique({ where: { id: employeeId } });
      if (!employee) throw new NotFoundException("Employee not found");
      return employee;
    });
  }

  async listEmploymentHistory(organizationId: string, employeeId: string) {
    await this.requireEmployee(organizationId, employeeId);
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.employmentHistory.findMany({ where: { organizationId, employeeId } }),
    );
  }

  async createEmploymentHistory(
    organizationId: string,
    employeeId: string,
    dto: CreateEmploymentHistoryDto,
  ) {
    await this.requireEmployee(organizationId, employeeId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      const [designation, department] = await Promise.all([
        tx.designation.findUnique({ where: { id: dto.designationId } }),
        dto.departmentId ? tx.department.findUnique({ where: { id: dto.departmentId } }) : null,
      ]);
      if (!designation) throw new NotFoundException("Designation not found");
      if (dto.departmentId && !department) throw new NotFoundException("Department not found");

      return tx.employmentHistory.create({
        data: {
          organizationId,
          employeeId,
          designationId: dto.designationId,
          departmentId: dto.departmentId,
          startDate: new Date(dto.startDate),
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          reason: dto.reason,
        },
      });
    });
  }

  async listQualifications(organizationId: string, employeeId: string) {
    await this.requireEmployee(organizationId, employeeId);
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.qualification.findMany({ where: { organizationId, employeeId } }),
    );
  }

  async createQualification(organizationId: string, employeeId: string, dto: CreateQualificationDto) {
    await this.requireEmployee(organizationId, employeeId);
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.qualification.create({
        data: {
          organizationId,
          employeeId,
          degree: dto.degree,
          institution: dto.institution,
          yearCompleted: dto.yearCompleted,
        },
      }),
    );
  }

  async getTeacherProfile(organizationId: string, employeeId: string) {
    await this.requireEmployee(organizationId, employeeId);
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.teacherProfile.findUnique({ where: { employeeId } }),
    );
  }

  async upsertTeacherProfile(
    organizationId: string,
    employeeId: string,
    dto: UpsertTeacherProfileDto,
  ) {
    await this.requireEmployee(organizationId, employeeId);
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.teacherProfile.upsert({
        where: { employeeId },
        update: { bio: dto.bio, specialization: dto.specialization },
        create: { organizationId, employeeId, bio: dto.bio, specialization: dto.specialization },
      }),
    );
  }
}
