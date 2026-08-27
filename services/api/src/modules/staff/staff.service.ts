import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import * as argon2 from "argon2";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateStaffTypeDto } from "./dto/create-staff-type.dto";
import { CreateDesignationDto } from "./dto/create-designation.dto";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { CreateEmploymentHistoryDto } from "./dto/create-employment-history.dto";
import { CreateQualificationDto } from "./dto/create-qualification.dto";
import { UpsertTeacherProfileDto } from "./dto/upsert-teacher-profile.dto";
import { CreateEmployeeLoginDto } from "./dto/create-employee-login.dto";
import { assertUnderEditionLimit } from "../organizations/edition-limits";

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
      await assertUnderEditionLimit(tx, organizationId);

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
          photoUrl: dto.photoUrl,
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

  /**
   * Mirrors StudentsService.createLogin almost exactly — same
   * pseudo-email-under-username-namespace reasoning (User.email stays
   * required+unique, this slice doesn't touch that). Unlike Student,
   * no role is assigned: this login only ever needs to reach the
   * JwtAuthGuard-only driver-portal routes, which check "is this the
   * right driver," not a permission string.
   */
  async createLogin(organizationId: string, employeeId: string, dto: CreateEmployeeLoginDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const employee = await tx.employee.findUnique({ where: { id: employeeId } });
      if (!employee) throw new NotFoundException("Employee not found");
      if (employee.userId) throw new ConflictException("This employee already has a login");

      const organization = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!organization) throw new NotFoundException("Organization not found");

      const username = `${organization.slug}.${employee.employeeCode}`;
      const passwordHash = await argon2.hash(dto.password);

      const user = await tx.user.create({
        data: {
          organizationId,
          email: `${username}@employee.local`,
          username,
          passwordHash,
          firstName: employee.firstName,
          lastName: employee.lastName,
          status: "ACTIVE",
        },
      });
      await tx.employee.update({ where: { id: employeeId }, data: { userId: user.id } });

      const { passwordHash: _passwordHash, ...safeUser } = user;
      return { ...safeUser, username };
    });
  }
}
