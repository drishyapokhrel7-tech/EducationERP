import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import { parse } from "csv-parse/sync";
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
import { ImportResult, ImportRowError } from "./dto/import-result.dto";
import { assertUnderEditionLimit, editionLimit, effectiveEdition } from "../organizations/edition-limits";
import { paginate } from "../../common/pagination";
import { assertNoDependents } from "../../common/assert-no-dependents";
import { buildWorkbook, parseWorkbookRows, type ColumnSpec } from "../../common/excel-sync";

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

  // The Excel round-trip counterpart to createEmployee/updateEmployee —
  // same shape and reasoning as StudentsService.importStudents (see that
  // method's own comment): a blank employeeCode creates a new employee
  // (server-generates the code, same as the web form), a filled one that
  // matches an existing employee updates it, and one that doesn't match
  // anything is a per-row error rather than a silent create. photoUrl is
  // deliberately not requested here — Student's own bulk import already
  // creates photo-less students (Employee.photoUrl is nullable at the
  // schema level, "mandatory" is only enforced in CreateEmployeeDto for
  // the single-record web form), so this follows the same accepted
  // exception rather than inventing a new one.
  async importEmployees(organizationId: string, fileBuffer: Buffer, originalName: string): Promise<ImportResult> {
    let records: Record<string, string>[];
    if (/\.xlsx$/i.test(originalName)) {
      try {
        records = await parseWorkbookRows(fileBuffer);
      } catch (err) {
        throw new BadRequestException((err as Error).message);
      }
    } else {
      try {
        records = parse(fileBuffer, { columns: true, skip_empty_lines: true, trim: true }) as Record<
          string,
          string
        >[];
      } catch (err) {
        throw new BadRequestException(`Could not parse CSV: ${(err as Error).message}`);
      }
    }

    const errors: ImportRowError[] = [];
    let created = 0;
    let updated = 0;

    await this.prisma.withTenant(organizationId, async (tx) => {
      const [existingRows, staffTypes, designations, departments, organization] = await Promise.all([
        // Full rows, not just id+code — same "don't write back an
        // unchanged row on a large re-sync" reasoning as
        // StudentsService.importStudents.
        tx.employee.findMany({
          where: { organizationId, deletedAt: null },
          select: {
            id: true,
            employeeCode: true,
            staffTypeId: true,
            designationId: true,
            departmentId: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
            phone: true,
            dateOfJoining: true,
          },
        }),
        tx.staffType.findMany({ where: { organizationId } }),
        tx.designation.findMany({ where: { organizationId } }),
        tx.department.findMany({ where: { organizationId, deletedAt: null } }),
        tx.organization.findUnique({ where: { id: organizationId } }),
      ]);
      const existingByCode = new Map(existingRows.map((e) => [e.employeeCode, e]));
      const staffTypeByName = new Map(staffTypes.map((t) => [t.name.toLowerCase(), t.id]));
      const designationByName = new Map(designations.map((d) => [d.name.toLowerCase(), d.id]));
      const departmentByName = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]));
      const seenCodes = new Set<string>();

      // Same "one upfront read + running counter" reasoning as
      // StudentsService.importStudents — only a create consumes this,
      // an update never does.
      const limit = organization ? editionLimit(effectiveEdition(organization)) : 0;
      const [activeStudentCount, activeEmployeeCount] = await Promise.all([
        tx.student.count({ where: { organizationId, deletedAt: null } }),
        tx.employee.count({ where: { organizationId, deletedAt: null } }),
      ]);
      let combinedCount = activeStudentCount + activeEmployeeCount;

      for (let i = 0; i < records.length; i++) {
        const rowNumber = i + 2;
        const row = records[i];
        const employeeCode = row.employeeCode?.trim();
        const staffTypeName = row.staffType?.trim();
        const designationName = row.designation?.trim();
        const departmentName = row.department?.trim() || undefined;
        const firstName = row.firstName?.trim();
        const middleName = row.middleName?.trim() || undefined;
        const lastName = row.lastName?.trim();
        const email = row.email?.trim();
        const phone = row.phone?.trim() || undefined;
        const dateOfJoiningRaw = row.dateOfJoining?.trim();

        if (!staffTypeName || !designationName || !firstName || !lastName || !email || !dateOfJoiningRaw) {
          errors.push({
            row: rowNumber,
            message: "Missing required field (staffType, designation, firstName, lastName, email, dateOfJoining)",
          });
          continue;
        }
        const dateOfJoining = new Date(dateOfJoiningRaw);
        if (Number.isNaN(dateOfJoining.getTime())) {
          errors.push({ row: rowNumber, message: `Invalid dateOfJoining "${dateOfJoiningRaw}"` });
          continue;
        }
        const staffTypeId = staffTypeByName.get(staffTypeName.toLowerCase());
        if (!staffTypeId) {
          errors.push({ row: rowNumber, message: `Staff type "${staffTypeName}" does not match any existing staff type` });
          continue;
        }
        const designationId = designationByName.get(designationName.toLowerCase());
        if (!designationId) {
          errors.push({ row: rowNumber, message: `Designation "${designationName}" does not match any existing designation` });
          continue;
        }
        let departmentId: string | undefined;
        if (departmentName) {
          departmentId = departmentByName.get(departmentName.toLowerCase());
          if (!departmentId) {
            errors.push({ row: rowNumber, message: `Department "${departmentName}" does not match any existing department` });
            continue;
          }
        }
        if (employeeCode && seenCodes.has(employeeCode)) {
          errors.push({ row: rowNumber, message: `Duplicate employeeCode "${employeeCode}" within this file` });
          continue;
        }

        const existing = employeeCode ? existingByCode.get(employeeCode) : undefined;
        if (employeeCode && existing) {
          const unchanged =
            existing.staffTypeId === staffTypeId &&
            existing.designationId === designationId &&
            (existing.departmentId ?? undefined) === departmentId &&
            existing.firstName === firstName &&
            (existing.middleName ?? undefined) === middleName &&
            existing.lastName === lastName &&
            existing.email === email &&
            (existing.phone ?? undefined) === phone &&
            existing.dateOfJoining.toISOString().slice(0, 10) === dateOfJoiningRaw;
          if (!unchanged) {
            await tx.employee.update({
              where: { id: existing.id },
              data: { staffTypeId, designationId, departmentId, firstName, middleName, lastName, email, phone, dateOfJoining },
            });
          }
          seenCodes.add(employeeCode);
          updated++;
          continue;
        }
        if (employeeCode && !existing) {
          errors.push({ row: rowNumber, message: `employeeCode "${employeeCode}" does not match any existing employee` });
          continue;
        }

        if (combinedCount >= limit) {
          errors.push({
            row: rowNumber,
            message: `${organization?.edition} edition's ${limit}-record limit reached — upgrade to import more`,
          });
          continue;
        }
        const newEmployeeCode = await this.nextEmployeeCode(tx, organizationId);
        await tx.employee.create({
          data: {
            organizationId,
            staffTypeId,
            designationId,
            departmentId,
            employeeCode: newEmployeeCode,
            firstName,
            middleName,
            lastName,
            email,
            phone,
            dateOfJoining,
          },
        });
        combinedCount++;
        created++;
      }
    });

    return { totalRows: records.length, created, updated, errors };
  }

  private async importColumns(organizationId: string): Promise<ColumnSpec[]> {
    const [staffTypes, designations, departments] = await Promise.all([
      this.prisma.withTenant(organizationId, (tx) => tx.staffType.findMany({ where: { organizationId } })),
      this.prisma.withTenant(organizationId, (tx) => tx.designation.findMany({ where: { organizationId } })),
      this.prisma.withTenant(organizationId, (tx) =>
        tx.department.findMany({ where: { organizationId, deletedAt: null } }),
      ),
    ]);
    return [
      {
        key: "employeeCode",
        header: "employeeCode",
        width: 14,
        note: "Leave blank for a new employee — filled in automatically. Fill in to update that existing employee.",
      },
      {
        key: "staffType",
        header: "staffType",
        width: 18,
        dropdownOptions: staffTypes.map((t) => t.name),
      },
      {
        key: "designation",
        header: "designation",
        width: 20,
        note: "Every designation is offered here regardless of staff type — a genuine mismatch is still caught when you sync.",
        dropdownOptions: designations.map((d) => d.name),
      },
      {
        key: "department",
        header: "department",
        width: 18,
        note: "Optional.",
        dropdownOptions: departments.map((d) => d.name),
      },
      { key: "firstName", header: "firstName", width: 16 },
      { key: "middleName", header: "middleName", width: 16 },
      { key: "lastName", header: "lastName", width: 16 },
      { key: "email", header: "email", width: 24 },
      { key: "phone", header: "phone", width: 16 },
      { key: "dateOfJoining", header: "dateOfJoining", width: 16, note: "Format: YYYY-MM-DD" },
    ];
  }

  // Downloadable starting point for a bulk import — same columns
  // importEmployees expects, Staff type/Designation/Department each
  // constrained to this org's real names via Excel's native in-cell
  // dropdown.
  async generateEmployeeImportTemplate(organizationId: string): Promise<Buffer> {
    const columns = await this.importColumns(organizationId);
    return buildWorkbook("Employees", columns, []);
  }

  // The other half of the round trip: the same template, pre-filled with
  // every current employee (employeeCode included, so re-uploading this
  // exact file after editing it updates those rows instead of rejecting
  // them). Download, edit in Excel, re-import via importEmployees, repeat.
  async exportEditableEmployees(organizationId: string): Promise<Buffer> {
    const [columns, employees] = await Promise.all([
      this.importColumns(organizationId),
      this.prisma.withTenant(organizationId, (tx) =>
        tx.employee.findMany({
          where: { organizationId, deletedAt: null },
          include: { staffType: true, designation: true, department: true },
          orderBy: { employeeCode: "asc" },
        }),
      ),
    ]);
    const rows = employees.map((e) => ({
      employeeCode: e.employeeCode,
      staffType: e.staffType.name,
      designation: e.designation.name,
      department: e.department?.name ?? "",
      firstName: e.firstName,
      middleName: e.middleName ?? "",
      lastName: e.lastName,
      email: e.email,
      phone: e.phone ?? "",
      dateOfJoining: e.dateOfJoining.toISOString().slice(0, 10),
    }));
    return buildWorkbook("Employees", columns, rows);
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
