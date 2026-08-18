import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateFacultyDto } from "./dto/create-faculty.dto";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { CreateProgramDto } from "./dto/create-program.dto";
import { CreateAcademicYearDto } from "./dto/create-academic-year.dto";
import { CreateTermDto } from "./dto/create-term.dto";
import { CreateSectionDto } from "./dto/create-section.dto";

/**
 * Every create* method here validates its parent reference (campusId,
 * facultyId, ...) belongs to the caller's organization *before* writing
 * the child row. This is not defense-in-depth — it's load-bearing:
 * Postgres foreign-key constraint checks run against the raw referenced
 * table, not the RLS-filtered view of it, so a plain FK alone would
 * happily let one tenant create a row pointing at another tenant's
 * parent. The RLS-scoped lookup (via withTenant) is what actually
 * closes that gap, by returning nothing for a parent outside the
 * caller's tenant.
 */
@Injectable()
export class OrgStructureService {
  constructor(private readonly prisma: PrismaService) {}

  listFaculties(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.faculty.findMany({ where: { organizationId, deletedAt: null } }),
    );
  }

  async createFaculty(organizationId: string, dto: CreateFacultyDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const campus = await tx.campus.findUnique({ where: { id: dto.campusId } });
      if (!campus) {
        throw new NotFoundException("Campus not found");
      }
      return tx.faculty.create({
        data: { organizationId, campusId: dto.campusId, name: dto.name, code: dto.code },
      });
    });
  }

  listDepartments(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.department.findMany({ where: { organizationId, deletedAt: null } }),
    );
  }

  async createDepartment(organizationId: string, dto: CreateDepartmentDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const faculty = await tx.faculty.findUnique({ where: { id: dto.facultyId } });
      if (!faculty) {
        throw new NotFoundException("Faculty not found");
      }
      return tx.department.create({
        data: { organizationId, facultyId: dto.facultyId, name: dto.name, code: dto.code },
      });
    });
  }

  listPrograms(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.program.findMany({ where: { organizationId, deletedAt: null } }),
    );
  }

  async createProgram(organizationId: string, dto: CreateProgramDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const department = await tx.department.findUnique({ where: { id: dto.departmentId } });
      if (!department) {
        throw new NotFoundException("Department not found");
      }
      return tx.program.create({
        data: {
          organizationId,
          departmentId: dto.departmentId,
          name: dto.name,
          code: dto.code,
          level: dto.level,
          durationSemesters: dto.durationSemesters,
          creditHours: dto.creditHours,
          entranceExam: dto.entranceExam,
        },
      });
    });
  }

  listAcademicYears(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.academicYear.findMany({ where: { organizationId } }),
    );
  }

  createAcademicYear(organizationId: string, dto: CreateAcademicYearDto) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.academicYear.create({
        data: {
          organizationId,
          name: dto.name,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
        },
      }),
    );
  }

  listTerms(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.term.findMany({ where: { organizationId } }),
    );
  }

  async createTerm(organizationId: string, dto: CreateTermDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const academicYear = await tx.academicYear.findUnique({
        where: { id: dto.academicYearId },
      });
      if (!academicYear) {
        throw new NotFoundException("Academic year not found");
      }
      return tx.term.create({
        data: {
          organizationId,
          academicYearId: dto.academicYearId,
          name: dto.name,
          code: dto.code,
          sequence: dto.sequence,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
        },
      });
    });
  }

  listSections(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.section.findMany({ where: { organizationId, deletedAt: null } }),
    );
  }

  async createSection(organizationId: string, dto: CreateSectionDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const [program, term] = await Promise.all([
        tx.program.findUnique({ where: { id: dto.programId } }),
        tx.term.findUnique({ where: { id: dto.termId } }),
      ]);
      if (!program) {
        throw new NotFoundException("Program not found");
      }
      if (!term) {
        throw new NotFoundException("Term not found");
      }
      return tx.section.create({
        data: {
          organizationId,
          programId: dto.programId,
          termId: dto.termId,
          name: dto.name,
          code: dto.code,
          capacity: dto.capacity,
        },
      });
    });
  }
}
