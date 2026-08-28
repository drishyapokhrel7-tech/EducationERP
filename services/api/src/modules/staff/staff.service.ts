import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateStaffTypeDto } from "./dto/create-staff-type.dto";
import { UpdateStaffTypeDto } from "./dto/update-staff-type.dto";
import { CreateDesignationDto } from "./dto/create-designation.dto";
import { UpdateDesignationDto } from "./dto/update-designation.dto";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { CreateEmploymentHistoryDto } from "./dto/create-employment-history.dto";
import { CreateQualificationDto } from "./dto/create-qualification.dto";
import { UpsertTeacherProfileDto } from "./dto/upsert-teacher-profile.dto";
import { CreateEmployeeLoginDto } from "./dto/create-employee-login.dto";
import { assertUnderEditionLimit } from "../organizations/edition-limits";
import { paginate } from "../../common/pagination";
import { assertNoDependents } from "../../common/assert-no-dependents";

// Seeded once per organization — at registration for a new org
// (AuthService.registerOrganization, same transaction as the org
// itself), and via a one-off backfill for orgs that already existed
// before this was added. Just a starting point, not a fixed/closed
// set — StaffType is fully editable/deletable (see updateStaffType/
// deleteStaffType below) so an admin can rename, remove, or add to
// this list freely once the org exists.
export const DEFAULT_STAFF_TYPES: { name: string; code: string }[] = [
  { name: "Guard", code: "GD" },
  { name: "Teacher", code: "TR" },
  { name: "Coordinator", code: "CR" },
  { name: "Principal", code: "PR" },
  { name: "Receptionist", code: "RC" },
  { name: "Driver", code: "DR" },
  { name: "Cantin", code: "CN" },
];

// Same seeding pattern as DEFAULT_STAFF_TYPES above, just for the
// Designation catalog — common school job-title hierarchy, not a
// closed set (fully editable/deletable afterward).
export const DEFAULT_DESIGNATIONS: { name: string; code: string }[] = [
  { name: "Principal", code: "PR" },
  { name: "Vice Principal", code: "VP" },
  { name: "Head Teacher", code: "HT" },
  { name: "Senior Teacher", code: "ST" },
  { name: "Teacher", code: "TR" },
  { name: "Coordinator", code: "CR" },
  { name: "Administrator", code: "AD" },
  { name: "Accountant", code: "AC" },
  { name: "Librarian", code: "LB" },
  { name: "Office Assistant", code: "OA" },
];

// The college counterpart of DEFAULT_STAFF_TYPES/DEFAULT_DESIGNATIONS
// above — seeded by OrganizationsService.createCampus whenever a
// COLLEGE-type campus is created (org-level, same as the school
// defaults, since StaffType/Designation have no campusId of their
// own), not just once at registration. Codes are deliberately
// disjoint from the school defaults' own codes so both sets coexist
// cleanly in an organization that runs both a school and a college
// (the seed-demo.ts precedent). Seeded with skipDuplicates — a second
// COLLEGE campus added later re-runs this harmlessly. Same starting-
// point, fully editable/deletable precedent as every other default
// list here.
export const DEFAULT_COLLEGE_STAFF_TYPES: { name: string; code: string }[] = [
  { name: "Professor", code: "PROF" },
  { name: "Associate Professor", code: "APROF" },
  { name: "Assistant Professor", code: "ASTPROF" },
  { name: "Lecturer", code: "LEC" },
  { name: "Teaching Assistant", code: "TA" },
  { name: "Lab Assistant", code: "LABAST" },
  { name: "Registrar", code: "REG" },
  { name: "Exam Controller", code: "EXAMC" },
];

export const DEFAULT_COLLEGE_DESIGNATIONS: { name: string; code: string }[] = [
  { name: "Dean", code: "DEAN" },
  { name: "Head of Department", code: "HOD" },
  { name: "Professor", code: "PROF" },
  { name: "Associate Professor", code: "APROF" },
  { name: "Assistant Professor", code: "ASTPROF" },
  { name: "Lecturer", code: "LEC" },
  { name: "Teaching Assistant", code: "TA" },
  { name: "Registrar", code: "REG" },
  { name: "Exam Controller", code: "EXAMC" },
  { name: "Lab Assistant", code: "LABAST" },
];

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

  async updateStaffType(organizationId: string, id: string, dto: UpdateStaffTypeDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadStaffType(tx, organizationId, id);
      return tx.staffType.update({ where: { id }, data: dto });
    });
  }

  async deleteStaffType(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadStaffType(tx, organizationId, id);
      await assertNoDependents([tx.employee.count({ where: { staffTypeId: id } })], "staff type");
      await tx.staffType.delete({ where: { id } });
      return { deleted: true };
    });
  }

  private async loadStaffType(tx: PrismaClient, organizationId: string, id: string) {
    const staffType = await tx.staffType.findUnique({ where: { id } });
    if (!staffType || staffType.organizationId !== organizationId) throw new NotFoundException("Staff type not found");
    return staffType;
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

  async updateDesignation(organizationId: string, id: string, dto: UpdateDesignationDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadDesignation(tx, organizationId, id);
      return tx.designation.update({ where: { id }, data: dto });
    });
  }

  async deleteDesignation(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadDesignation(tx, organizationId, id);
      await assertNoDependents(
        [
          tx.employee.count({ where: { designationId: id } }),
          tx.employmentHistory.count({ where: { designationId: id } }),
        ],
        "designation",
      );
      await tx.designation.delete({ where: { id } });
      return { deleted: true };
    });
  }

  private async loadDesignation(tx: PrismaClient, organizationId: string, id: string) {
    const designation = await tx.designation.findUnique({ where: { id } });
    if (!designation || designation.organizationId !== organizationId) throw new NotFoundException("Designation not found");
    return designation;
  }

  // Deliberately unbounded, deliberately narrow — same reasoning as
  // StudentsService.listStudentsPicker: every "pick a staff member"
  // dropdown across the app needs the whole roster, not one page, but
  // none of them need the joined staffType/designation/department
  // rows. Phase 8 performance-optimization slice.
  listEmployeesPicker(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.employee.findMany({
        where: { organizationId, deletedAt: null },
        select: {
          id: true,
          userId: true,
          firstName: true,
          middleName: true,
          lastName: true,
          employeeCode: true,
          status: true,
        },
        orderBy: [{ firstName: "asc" }, { middleName: "asc" }, { lastName: "asc" }],
      }),
    );
  }

  // Paginated (Phase 8 performance-optimization slice) — same
  // required-orderBy reasoning as StudentsService.listStudents.
  listEmployees(organizationId: string, page: number, pageSize: number) {
    return this.prisma.withTenant(organizationId, (tx) => {
      const where = { organizationId, deletedAt: null };
      return paginate(
        () =>
          tx.employee.findMany({
            where,
            include: { staffType: true, designation: true, department: true },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
        () => tx.employee.count({ where }),
        page,
        pageSize,
      );
    });
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
          middleName: dto.middleName,
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
