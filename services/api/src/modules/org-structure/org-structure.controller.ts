import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { OrgStructureService } from "./org-structure.service";
import { CreateFacultyDto } from "./dto/create-faculty.dto";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { CreateProgramDto } from "./dto/create-program.dto";
import { CreateAcademicYearDto } from "./dto/create-academic-year.dto";
import { CreateTermDto } from "./dto/create-term.dto";
import { CreateSectionDto } from "./dto/create-section.dto";
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

  @Get("terms")
  @RequirePermissions("term:view")
  listTerms(@CurrentUser() user: JwtPayload) {
    return this.orgStructure.listTerms(user.organizationId);
  }

  @Post("terms")
  @RequirePermissions("term:create")
  createTerm(@CurrentUser() user: JwtPayload, @Body() dto: CreateTermDto) {
    return this.orgStructure.createTerm(user.organizationId, dto);
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
}
