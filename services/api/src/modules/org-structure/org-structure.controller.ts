import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { OrgStructureService } from "./org-structure.service";
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
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me")
export class OrgStructureController {
  constructor(private readonly orgStructure: OrgStructureService) {}

  @Get("faculties")
  @RequirePermissions("faculty:view")
  listFaculties(@CurrentUser() user: JwtPayload) {
    return this.orgStructure.listFaculties(user.organizationId);
  }

  @Post("faculties")
  @RequirePermissions("faculty:create")
  createFaculty(@CurrentUser() user: JwtPayload, @Body() dto: CreateFacultyDto) {
    return this.orgStructure.createFaculty(user.organizationId, dto);
  }

  @Patch("faculties/:id")
  @RequirePermissions("faculty:update")
  updateFaculty(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateFacultyDto) {
    return this.orgStructure.updateFaculty(user.organizationId, id, dto);
  }

  @Delete("faculties/:id")
  @RequirePermissions("faculty:delete")
  deleteFaculty(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.orgStructure.deleteFaculty(user.organizationId, id);
  }

  @Get("departments")
  @RequirePermissions("department:view")
  listDepartments(@CurrentUser() user: JwtPayload) {
    return this.orgStructure.listDepartments(user.organizationId);
  }

  @Post("departments")
  @RequirePermissions("department:create")
  createDepartment(@CurrentUser() user: JwtPayload, @Body() dto: CreateDepartmentDto) {
    return this.orgStructure.createDepartment(user.organizationId, dto);
  }

  @Patch("departments/:id")
  @RequirePermissions("department:update")
  updateDepartment(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateDepartmentDto) {
    return this.orgStructure.updateDepartment(user.organizationId, id, dto);
  }

  @Delete("departments/:id")
  @RequirePermissions("department:delete")
  deleteDepartment(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.orgStructure.deleteDepartment(user.organizationId, id);
  }

  @Get("programs")
  @RequirePermissions("program:view")
  listPrograms(@CurrentUser() user: JwtPayload) {
    return this.orgStructure.listPrograms(user.organizationId);
  }

  @Post("programs")
  @RequirePermissions("program:create")
  createProgram(@CurrentUser() user: JwtPayload, @Body() dto: CreateProgramDto) {
    return this.orgStructure.createProgram(user.organizationId, dto);
  }

  @Patch("programs/:id")
  @RequirePermissions("program:update")
  updateProgram(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateProgramDto) {
    return this.orgStructure.updateProgram(user.organizationId, id, dto);
  }

  @Delete("programs/:id")
  @RequirePermissions("program:delete")
  deleteProgram(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.orgStructure.deleteProgram(user.organizationId, id);
  }

  @Get("academic-years")
  @RequirePermissions("academic_year:view")
  listAcademicYears(@CurrentUser() user: JwtPayload) {
    return this.orgStructure.listAcademicYears(user.organizationId);
  }

  @Post("academic-years")
  @RequirePermissions("academic_year:create")
  createAcademicYear(@CurrentUser() user: JwtPayload, @Body() dto: CreateAcademicYearDto) {
    return this.orgStructure.createAcademicYear(user.organizationId, dto);
  }

  @Patch("academic-years/:id")
  @RequirePermissions("academic_year:update")
  updateAcademicYear(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateAcademicYearDto) {
    return this.orgStructure.updateAcademicYear(user.organizationId, id, dto);
  }

  @Delete("academic-years/:id")
  @RequirePermissions("academic_year:delete")
  deleteAcademicYear(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.orgStructure.deleteAcademicYear(user.organizationId, id);
  }

  @Get("semesters")
  @RequirePermissions("semester:view")
  listSemesters(@CurrentUser() user: JwtPayload) {
    return this.orgStructure.listSemesters(user.organizationId);
  }

  @Post("semesters")
  @RequirePermissions("semester:create")
  createSemester(@CurrentUser() user: JwtPayload, @Body() dto: CreateSemesterDto) {
    return this.orgStructure.createSemester(user.organizationId, dto);
  }

  @Patch("semesters/:id")
  @RequirePermissions("semester:update")
  updateSemester(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateSemesterDto) {
    return this.orgStructure.updateSemester(user.organizationId, id, dto);
  }

  @Delete("semesters/:id")
  @RequirePermissions("semester:delete")
  deleteSemester(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.orgStructure.deleteSemester(user.organizationId, id);
  }

  // Term Exams are scoped per semester (Mid Term/Internal/Pre-board
  // Exam) — a genuinely separate concept from Semester itself, see
  // Semester/TermExam's own schema doc comments. Only the Exam module
  // ever references a TermExam; enrollment/section/fee/timetable/
  // syllabus never do.
  @Get("term-exams")
  @RequirePermissions("term_exam:view")
  listTermExams(@CurrentUser() user: JwtPayload, @Query("semesterId") semesterId?: string) {
    return this.orgStructure.listTermExams(user.organizationId, semesterId);
  }

  @Post("term-exams")
  @RequirePermissions("term_exam:create")
  createTermExam(@CurrentUser() user: JwtPayload, @Body() dto: CreateTermExamDto) {
    return this.orgStructure.createTermExam(user.organizationId, dto);
  }

  @Patch("term-exams/:id")
  @RequirePermissions("term_exam:update")
  updateTermExam(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateTermExamDto) {
    return this.orgStructure.updateTermExam(user.organizationId, id, dto);
  }

  @Delete("term-exams/:id")
  @RequirePermissions("term_exam:delete")
  deleteTermExam(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.orgStructure.deleteTermExam(user.organizationId, id);
  }

  @Get("sections")
  @RequirePermissions("section:view")
  listSections(@CurrentUser() user: JwtPayload) {
    return this.orgStructure.listSections(user.organizationId);
  }

  @Post("sections")
  @RequirePermissions("section:create")
  createSection(@CurrentUser() user: JwtPayload, @Body() dto: CreateSectionDto) {
    return this.orgStructure.createSection(user.organizationId, dto);
  }

  @Patch("sections/:id")
  @RequirePermissions("section:update")
  updateSection(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateSectionDto) {
    return this.orgStructure.updateSection(user.organizationId, id, dto);
  }

  @Delete("sections/:id")
  @RequirePermissions("section:delete")
  deleteSection(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.orgStructure.deleteSection(user.organizationId, id);
  }
}
