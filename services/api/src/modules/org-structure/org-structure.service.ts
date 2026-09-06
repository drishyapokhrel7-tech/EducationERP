import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { assertNoDependents } from "../../common/assert-no-dependents";
import { CreateFacultyDto } from "./dto/create-faculty.dto";
import { UpdateFacultyDto } from "./dto/update-faculty.dto";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";
import { CreateProgramDto } from "./dto/create-program.dto";
import { UpdateProgramDto } from "./dto/update-program.dto";
import { CreateAcademicYearDto } from "./dto/create-academic-year.dto";
import { UpdateAcademicYearDto } from "./dto/update-academic-year.dto";
import { CreateSemesterDto } from "./dto/create-semester.dto";
import { UpdateSemesterDto } from "./dto/update-semester.dto";
import { CreateTermExamDto } from "./dto/create-term-exam.dto";
import { UpdateTermExamDto } from "./dto/update-term-exam.dto";
import { CreateSectionDto } from "./dto/create-section.dto";
import { UpdateSectionDto } from "./dto/update-section.dto";

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

  async updateFaculty(organizationId: string, id: string, dto: UpdateFacultyDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadFaculty(tx, organizationId, id);
      return tx.faculty.update({ where: { id }, data: dto });
    });
  }

  async deleteFaculty(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadFaculty(tx, organizationId, id);
      await assertNoDependents([tx.department.count({ where: { facultyId: id } })], "faculty");
      await tx.faculty.delete({ where: { id } });
      return { deleted: true };
    });
  }

  private async loadFaculty(tx: PrismaClient, organizationId: string, id: string) {
    const faculty = await tx.faculty.findUnique({ where: { id } });
    if (!faculty || faculty.organizationId !== organizationId) throw new NotFoundException("Faculty not found");
    return faculty;
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

  async updateDepartment(organizationId: string, id: string, dto: UpdateDepartmentDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadDepartment(tx, organizationId, id);
      return tx.department.update({ where: { id }, data: dto });
    });
  }

  async deleteDepartment(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadDepartment(tx, organizationId, id);
      await assertNoDependents(
        [
          tx.program.count({ where: { departmentId: id } }),
          tx.employee.count({ where: { departmentId: id } }),
          tx.employmentHistory.count({ where: { departmentId: id } }),
        ],
        "department",
      );
      await tx.department.delete({ where: { id } });
      return { deleted: true };
    });
  }

  private async loadDepartment(tx: PrismaClient, organizationId: string, id: string) {
    const department = await tx.department.findUnique({ where: { id } });
    if (!department || department.organizationId !== organizationId) {
      throw new NotFoundException("Department not found");
    }
    return department;
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

  async updateProgram(organizationId: string, id: string, dto: UpdateProgramDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadProgram(tx, organizationId, id);
      return tx.program.update({ where: { id }, data: dto });
    });
  }

  async deleteProgram(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadProgram(tx, organizationId, id);
      await assertNoDependents(
        [
          tx.curriculum.count({ where: { programId: id } }),
          tx.section.count({ where: { programId: id } }),
          tx.studentEnrollment.count({ where: { programId: id } }),
          tx.admissionApplication.count({ where: { programId: id } }),
          tx.feeStructure.count({ where: { programId: id } }),
        ],
        "program",
      );
      await tx.program.delete({ where: { id } });
      return { deleted: true };
    });
  }

  private async loadProgram(tx: PrismaClient, organizationId: string, id: string) {
    const program = await tx.program.findUnique({ where: { id } });
    if (!program || program.organizationId !== organizationId) throw new NotFoundException("Program not found");
    return program;
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

  async updateAcademicYear(organizationId: string, id: string, dto: UpdateAcademicYearDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadAcademicYear(tx, organizationId, id);
      return tx.academicYear.update({
        where: { id },
        data: {
          name: dto.name,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        },
      });
    });
  }

  async deleteAcademicYear(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadAcademicYear(tx, organizationId, id);
      await assertNoDependents([tx.semester.count({ where: { academicYearId: id } })], "academic year");
      await tx.academicYear.delete({ where: { id } });
      return { deleted: true };
    });
  }

  private async loadAcademicYear(tx: PrismaClient, organizationId: string, id: string) {
    const academicYear = await tx.academicYear.findUnique({ where: { id } });
    if (!academicYear || academicYear.organizationId !== organizationId) {
      throw new NotFoundException("Academic year not found");
    }
    return academicYear;
  }

  listSemesters(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.semester.findMany({ where: { organizationId } }),
    );
  }

  async createSemester(organizationId: string, dto: CreateSemesterDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const academicYear = await tx.academicYear.findUnique({
        where: { id: dto.academicYearId },
      });
      if (!academicYear) {
        throw new NotFoundException("Academic year not found");
      }
      return tx.semester.create({
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

  async updateSemester(organizationId: string, id: string, dto: UpdateSemesterDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadSemester(tx, organizationId, id);
      return tx.semester.update({
        where: { id },
        data: {
          academicYearId: dto.academicYearId,
          name: dto.name,
          code: dto.code,
          sequence: dto.sequence,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        },
      });
    });
  }

  async deleteSemester(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadSemester(tx, organizationId, id);
      await assertNoDependents(
        [
          tx.section.count({ where: { semesterId: id } }),
          tx.studentEnrollment.count({ where: { semesterId: id } }),
          tx.teachingAssignment.count({ where: { semesterId: id } }),
          tx.classSchedule.count({ where: { semesterId: id } }),
          tx.syllabus.count({ where: { semesterId: id } }),
          tx.feeStructure.count({ where: { semesterId: id } }),
          tx.termExam.count({ where: { semesterId: id } }),
        ],
        "semester",
      );
      await tx.semester.delete({ where: { id } });
      return { deleted: true };
    });
  }

  private async loadSemester(tx: PrismaClient, organizationId: string, id: string) {
    const semester = await tx.semester.findUnique({ where: { id } });
    if (!semester || semester.organizationId !== organizationId) throw new NotFoundException("Semester not found");
    return semester;
  }

  listTermExams(organizationId: string, semesterId?: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.termExam.findMany({ where: { organizationId, ...(semesterId ? { semesterId } : {}) } }),
    );
  }

  async createTermExam(organizationId: string, dto: CreateTermExamDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const semester = await tx.semester.findUnique({ where: { id: dto.semesterId } });
      if (!semester) {
        throw new NotFoundException("Semester not found");
      }
      return tx.termExam.create({
        data: {
          organizationId,
          semesterId: dto.semesterId,
          name: dto.name,
          code: dto.code,
          sequence: dto.sequence,
        },
      });
    });
  }

  async updateTermExam(organizationId: string, id: string, dto: UpdateTermExamDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadTermExam(tx, organizationId, id);
      return tx.termExam.update({
        where: { id },
        data: {
          name: dto.name,
          code: dto.code,
          sequence: dto.sequence,
        },
      });
    });
  }

  async deleteTermExam(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadTermExam(tx, organizationId, id);
      await assertNoDependents([tx.exam.count({ where: { termExamId: id } })], "term exam");
      await tx.termExam.delete({ where: { id } });
      return { deleted: true };
    });
  }

  private async loadTermExam(tx: PrismaClient, organizationId: string, id: string) {
    const termExam = await tx.termExam.findUnique({ where: { id } });
    if (!termExam || termExam.organizationId !== organizationId) throw new NotFoundException("Term exam not found");
    return termExam;
  }

  listSections(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.section.findMany({ where: { organizationId, deletedAt: null } }),
    );
  }

  async createSection(organizationId: string, dto: CreateSectionDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const [program, semester] = await Promise.all([
        tx.program.findUnique({ where: { id: dto.programId } }),
        tx.semester.findUnique({ where: { id: dto.semesterId } }),
      ]);
      if (!program) {
        throw new NotFoundException("Program not found");
      }
      if (!semester) {
        throw new NotFoundException("Semester not found");
      }
      return tx.section.create({
        data: {
          organizationId,
          programId: dto.programId,
          semesterId: dto.semesterId,
          name: dto.name,
          code: dto.code,
          capacity: dto.capacity,
        },
      });
    });
  }

  async updateSection(organizationId: string, id: string, dto: UpdateSectionDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadSection(tx, organizationId, id);
      return tx.section.update({ where: { id }, data: dto });
    });
  }

  async deleteSection(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadSection(tx, organizationId, id);
      await assertNoDependents(
        [
          tx.studentEnrollment.count({ where: { sectionId: id } }),
          tx.teachingAssignment.count({ where: { sectionId: id } }),
          tx.classSchedule.count({ where: { sectionId: id } }),
          tx.attendanceSession.count({ where: { sectionId: id } }),
          tx.classSession.count({ where: { sectionId: id } }),
        ],
        "section",
      );
      await tx.section.delete({ where: { id } });
      return { deleted: true };
    });
  }

  private async loadSection(tx: PrismaClient, organizationId: string, id: string) {
    const section = await tx.section.findUnique({ where: { id } });
    if (!section || section.organizationId !== organizationId) throw new NotFoundException("Section not found");
    return section;
  }
}
