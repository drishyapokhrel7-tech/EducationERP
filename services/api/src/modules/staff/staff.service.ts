import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateStaffTypeDto } from "./dto/create-staff-type.dto";
import { UpdateStaffTypeDto } from "./dto/update-staff-type.dto";
import { CreateDesignationDto } from "./dto/create-designation.dto";
import { UpdateDesignationDto } from "./dto/update-designation.dto";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
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
// this list freely once the org exists. Four entries here
// (Administrator/Accountant/Librarian/Office Assistant) exist only to
// give DEFAULT_DESIGNATIONS' matching rows below a real staff type to
// attach to — real reporting-style job titles, not administrative
// filler, so they earn a place in this list the same as any other.
export const DEFAULT_STAFF_TYPES: { name: string; code: string }[] = [
  { name: "Guard", code: "GD" },
  { name: "Teacher", code: "TR" },
  { name: "Coordinator", code: "CR" },
  { name: "Principal", code: "PR" },
  { name: "Receptionist", code: "RC" },
  { name: "Driver", code: "DR" },
  { name: "Cantin", code: "CN" },
  { name: "Administrator", code: "AD" },
  { name: "Accountant", code: "AC" },
  { name: "Librarian", code: "LB" },
  { name: "Office Assistant", code: "OA" },
];

// Same seeding pattern as DEFAULT_STAFF_TYPES above, just for the
// Designation catalog — common school job-title hierarchy, not a
// closed set (fully editable/deletable afterward). `staffTypeCode`
// is this row's DEFAULT_STAFF_TYPES.code match — the two lists used to
// be seeded with zero cross-referencing (a real bug: e.g. selecting
// "Teacher" as staff type still showed "Librarian" as a designation
// choice), so both insertion sites below now resolve this into a real
// staffTypeId once the matching StaffType rows exist.
export const DEFAULT_DESIGNATIONS: { name: string; code: string; staffTypeCode: string }[] = [
  { name: "Principal", code: "PR", staffTypeCode: "PR" },
  { name: "Vice Principal", code: "VP", staffTypeCode: "PR" },
  { name: "Head Teacher", code: "HT", staffTypeCode: "TR" },
  { name: "Senior Teacher", code: "ST", staffTypeCode: "TR" },
  { name: "Teacher", code: "TR", staffTypeCode: "TR" },
  { name: "Coordinator", code: "CR", staffTypeCode: "CR" },
  { name: "Administrator", code: "AD", staffTypeCode: "AD" },
  { name: "Accountant", code: "AC", staffTypeCode: "AC" },
  { name: "Librarian", code: "LB", staffTypeCode: "LB" },
  { name: "Office Assistant", code: "OA", staffTypeCode: "OA" },
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
// list here. Dean/Head of Department are added as their own staff
// types (not folded into e.g. Professor) for the same
// give-every-designation-a-real-match reason as the school list above.
export const DEFAULT_COLLEGE_STAFF_TYPES: { name: string; code: string }[] = [
  { name: "Professor", code: "PROF" },
  { name: "Associate Professor", code: "APROF" },
  { name: "Assistant Professor", code: "ASTPROF" },
  { name: "Lecturer", code: "LEC" },
  { name: "Teaching Assistant", code: "TA" },
  { name: "Lab Assistant", code: "LABAST" },
  { name: "Registrar", code: "REG" },
  { name: "Exam Controller", code: "EXAMC" },
  { name: "Dean", code: "DEAN" },
  { name: "Head of Department", code: "HOD" },
];

export const DEFAULT_COLLEGE_DESIGNATIONS: { name: string; code: string; staffTypeCode: string }[] = [
  { name: "Dean", code: "DEAN", staffTypeCode: "DEAN" },
  { name: "Head of Department", code: "HOD", staffTypeCode: "HOD" },
  { name: "Professor", code: "PROF", staffTypeCode: "PROF" },
  { name: "Associate Professor", code: "APROF", staffTypeCode: "APROF" },
  { name: "Assistant Professor", code: "ASTPROF", staffTypeCode: "ASTPROF" },
  { name: "Lecturer", code: "LEC", staffTypeCode: "LEC" },
  { name: "Teaching Assistant", code: "TA", staffTypeCode: "TA" },
  { name: "Registrar", code: "REG", staffTypeCode: "REG" },
  { name: "Exam Controller", code: "EXAMC", staffTypeCode: "EXAMC" },
  { name: "Lab Assistant", code: "LABAST", staffTypeCode: "LABAST" },
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

  async createDesignation(organizationId: string, dto: CreateDesignationDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      if (dto.staffTypeId) await this.loadStaffType(tx, organizationId, dto.staffTypeId);
      return tx.designation.create({
        data: { organizationId, name: dto.name, code: dto.code, staffTypeId: dto.staffTypeId },
      });
    });
  }

  async updateDesignation(organizationId: string, id: string, dto: UpdateDesignationDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadDesignation(tx, organizationId, id);
      if (dto.staffTypeId) await this.loadStaffType(tx, organizationId, dto.staffTypeId);
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
  // dropdown across the app needs the whole roster, not one page.
  // Carries photoUrl + designation/staff-type name so those dropdowns
  // can render an avatar + identity line rather than a bare name;
  // that's two lightweight name-only joins, not the full
  // staffType/designation/department graph.
  listEmployeesPicker(organizationId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const employees = await tx.employee.findMany({
        where: { organizationId, deletedAt: null },
        select: {
          id: true,
          userId: true,
          firstName: true,
          middleName: true,
          lastName: true,
          employeeCode: true,
          status: true,
          photoUrl: true,
          designation: { select: { name: true } },
          staffType: { select: { name: true } },
        },
        orderBy: [{ firstName: "asc" }, { middleName: "asc" }, { lastName: "asc" }],
      });
      return employees.map(({ designation, staffType, ...e }) => ({
        ...e,
        designationName: designation.name,
        staffTypeName: staffType.name,
      }));
    });
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

  // Same system-generated-code precedent as StudentsService.
  // nextStudentCode/createStudent — an admin picking their own
  // employeeCode was real duplicate/typo-prone busywork for something
  // that only ever needs to be unique, not meaningful. Not private:
  // available the same way for any future bulk/import path, though
  // none exists yet for Employee.
  async nextEmployeeCode(tx: PrismaClient, organizationId: string): Promise<string> {
    const count = await tx.employee.count({ where: { organizationId } });
    return `EMP-${String(count + 1).padStart(4, "0")}`;
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

      const maxAttempts = 5;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const employeeCode = await this.nextEmployeeCode(tx, organizationId);
        try {
          return await tx.employee.create({
            data: {
              organizationId,
              staffTypeId: dto.staffTypeId,
              designationId: dto.designationId,
              departmentId: dto.departmentId,
              employeeCode,
              firstName: dto.firstName,
              middleName: dto.middleName,
              lastName: dto.lastName,
              email: dto.email,
              phone: dto.phone,
              dateOfJoining: new Date(dto.dateOfJoining),
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
      throw new Error("Could not generate a unique employee code — please try again");
    });
  }

  private async requireEmployee(organizationId: string, employeeId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const employee = await tx.employee.findUnique({ where: { id: employeeId } });
      if (!employee) throw new NotFoundException("Employee not found");
      return employee;
    });
  }

  async updateEmployee(organizationId: string, id: string, dto: UpdateEmployeeDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadEmployee(tx, organizationId, id);
      const [staffType, designation, department] = await Promise.all([
        dto.staffTypeId ? tx.staffType.findUnique({ where: { id: dto.staffTypeId } }) : null,
        dto.designationId ? tx.designation.findUnique({ where: { id: dto.designationId } }) : null,
        dto.departmentId ? tx.department.findUnique({ where: { id: dto.departmentId } }) : null,
      ]);
      if (dto.staffTypeId && !staffType) throw new NotFoundException("Staff type not found");
      if (dto.designationId && !designation) throw new NotFoundException("Designation not found");
      if (dto.departmentId && !department) throw new NotFoundException("Department not found");

      return tx.employee.update({
        where: { id },
        data: {
          staffTypeId: dto.staffTypeId,
          designationId: dto.designationId,
          departmentId: dto.departmentId,
          firstName: dto.firstName,
          middleName: dto.middleName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          dateOfJoining: dto.dateOfJoining ? new Date(dto.dateOfJoining) : undefined,
          photoUrl: dto.photoUrl,
        },
      });
    });
  }

  // Same reasoning as StudentsService.deleteStudent: a real employee
  // accumulates dependents almost immediately (employment history,
  // a leave balance, a payroll run, ...), so this guard is expected to
  // block deletion for anyone who's actually been used in the system —
  // it exists for the mistaken-entry case. A portal login is blocked
  // separately, same reasoning as Student.
  async deleteEmployee(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const employee = await this.loadEmployee(tx, organizationId, id);
      if (employee.userId) {
        throw new ConflictException("This employee has a portal login — remove that first before deleting the record");
      }
      await assertNoDependents(
        [
          tx.employmentHistory.count({ where: { employeeId: id } }),
          tx.qualification.count({ where: { employeeId: id } }),
          tx.teacherProfile.count({ where: { employeeId: id } }),
          tx.teachingAssignment.count({ where: { employeeId: id } }),
          tx.staffAttendance.count({ where: { employeeId: id } }),
          tx.staffLeaveBalance.count({ where: { employeeId: id } }),
          tx.leaveRequest.count({ where: { employeeId: id } }),
          tx.payroll.count({ where: { employeeId: id } }),
          tx.driver.count({ where: { employeeId: id } }),
          tx.staffDocument.count({ where: { employeeId: id } }),
        ],
        "employee",
      );
      await tx.employee.delete({ where: { id } });
      return { deleted: true };
    });
  }

  private async loadEmployee(tx: PrismaClient, organizationId: string, id: string) {
    const employee = await tx.employee.findUnique({ where: { id } });
    if (!employee || employee.organizationId !== organizationId) throw new NotFoundException("Employee not found");
    return employee;
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
