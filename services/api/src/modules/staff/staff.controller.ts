import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { StaffService } from "./staff.service";
import { CreateStaffTypeDto } from "./dto/create-staff-type.dto";
import { CreateDesignationDto } from "./dto/create-designation.dto";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { CreateEmploymentHistoryDto } from "./dto/create-employment-history.dto";
import { CreateQualificationDto } from "./dto/create-qualification.dto";
import { UpsertTeacherProfileDto } from "./dto/upsert-teacher-profile.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me")
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get("staff-types")
  @RequirePermissions("staff_type:view")
  listStaffTypes(@CurrentUser() user: JwtPayload) {
    return this.staff.listStaffTypes(user.organizationId);
  }

  @Post("staff-types")
  @RequirePermissions("staff_type:create")
  createStaffType(@CurrentUser() user: JwtPayload, @Body() dto: CreateStaffTypeDto) {
    return this.staff.createStaffType(user.organizationId, dto);
  }

  @Get("designations")
  @RequirePermissions("designation:view")
  listDesignations(@CurrentUser() user: JwtPayload) {
    return this.staff.listDesignations(user.organizationId);
  }

  @Post("designations")
  @RequirePermissions("designation:create")
  createDesignation(@CurrentUser() user: JwtPayload, @Body() dto: CreateDesignationDto) {
    return this.staff.createDesignation(user.organizationId, dto);
  }

  @Get("employees")
  @RequirePermissions("employee:view")
  listEmployees(@CurrentUser() user: JwtPayload) {
    return this.staff.listEmployees(user.organizationId);
  }

  @Post("employees")
  @RequirePermissions("employee:create")
  createEmployee(@CurrentUser() user: JwtPayload, @Body() dto: CreateEmployeeDto) {
    return this.staff.createEmployee(user.organizationId, dto);
  }

  @Get("employees/:employeeId/employment-history")
  @RequirePermissions("employment_history:view")
  listEmploymentHistory(@CurrentUser() user: JwtPayload, @Param("employeeId") employeeId: string) {
    return this.staff.listEmploymentHistory(user.organizationId, employeeId);
  }

  @Post("employees/:employeeId/employment-history")
  @RequirePermissions("employment_history:create")
  createEmploymentHistory(
    @CurrentUser() user: JwtPayload,
    @Param("employeeId") employeeId: string,
    @Body() dto: CreateEmploymentHistoryDto,
  ) {
    return this.staff.createEmploymentHistory(user.organizationId, employeeId, dto);
  }

  @Get("employees/:employeeId/qualifications")
  @RequirePermissions("qualification:view")
  listQualifications(@CurrentUser() user: JwtPayload, @Param("employeeId") employeeId: string) {
    return this.staff.listQualifications(user.organizationId, employeeId);
  }

  @Post("employees/:employeeId/qualifications")
  @RequirePermissions("qualification:create")
  createQualification(
    @CurrentUser() user: JwtPayload,
    @Param("employeeId") employeeId: string,
    @Body() dto: CreateQualificationDto,
  ) {
    return this.staff.createQualification(user.organizationId, employeeId, dto);
  }

  @Get("employees/:employeeId/teacher-profile")
  @RequirePermissions("teacher_profile:view")
  getTeacherProfile(@CurrentUser() user: JwtPayload, @Param("employeeId") employeeId: string) {
    return this.staff.getTeacherProfile(user.organizationId, employeeId);
  }

  @Put("employees/:employeeId/teacher-profile")
  @RequirePermissions("teacher_profile:manage")
  upsertTeacherProfile(
    @CurrentUser() user: JwtPayload,
    @Param("employeeId") employeeId: string,
    @Body() dto: UpsertTeacherProfileDto,
  ) {
    return this.staff.upsertTeacherProfile(user.organizationId, employeeId, dto);
  }
}
