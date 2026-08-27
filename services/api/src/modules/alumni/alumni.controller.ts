import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AlumniService } from "./alumni.service";
import { CreateAlumniProfileDto } from "./dto/create-alumni-profile.dto";
import { UpdateAlumniProfileDto } from "./dto/update-alumni-profile.dto";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { CreateEducationDto } from "./dto/create-education.dto";
import { CreateCareerHistoryDto } from "./dto/create-career-history.dto";
import { UpdateCareerHistoryDto } from "./dto/update-career-history.dto";
import { CreateSkillDto } from "./dto/create-skill.dto";
import { CreateCertificationDto } from "./dto/create-certification.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me")
export class AlumniController {
  constructor(private readonly alumni: AlumniService) {}

  @Post("alumni-profiles")
  @RequirePermissions("alumni:create")
  createProfile(@CurrentUser() user: JwtPayload, @Body() dto: CreateAlumniProfileDto) {
    return this.alumni.createProfile(user.organizationId, dto);
  }

  @Get("alumni-profiles")
  @RequirePermissions("alumni:view")
  listProfiles(@CurrentUser() user: JwtPayload) {
    return this.alumni.listProfiles(user.organizationId);
  }

  @Get("alumni-profiles/:id")
  @RequirePermissions("alumni:view")
  getProfile(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.alumni.getProfile(user.organizationId, id);
  }

  @Patch("alumni-profiles/:id")
  @RequirePermissions("alumni:manage")
  updateProfile(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateAlumniProfileDto) {
    return this.alumni.updateProfile(user.organizationId, id, dto);
  }

  @Post("alumni-companies")
  @RequirePermissions("alumni:create")
  createCompany(@CurrentUser() user: JwtPayload, @Body() dto: CreateCompanyDto) {
    return this.alumni.createCompany(user.organizationId, dto);
  }

  @Get("alumni-companies")
  @RequirePermissions("alumni:view")
  listCompanies(@CurrentUser() user: JwtPayload) {
    return this.alumni.listCompanies(user.organizationId);
  }

  @Post("alumni-profiles/:id/education")
  @RequirePermissions("alumni:manage")
  addEducation(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: CreateEducationDto) {
    return this.alumni.addEducation(user.organizationId, id, dto);
  }

  @Delete("alumni-education/:id")
  @RequirePermissions("alumni:manage")
  removeEducation(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.alumni.removeEducation(user.organizationId, id);
  }

  @Post("alumni-profiles/:id/career-history")
  @RequirePermissions("alumni:manage")
  addCareerHistory(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: CreateCareerHistoryDto) {
    return this.alumni.addCareerHistory(user.organizationId, id, dto);
  }

  @Patch("alumni-career-history/:id")
  @RequirePermissions("alumni:manage")
  updateCareerHistory(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateCareerHistoryDto) {
    return this.alumni.updateCareerHistory(user.organizationId, id, dto);
  }

  @Delete("alumni-career-history/:id")
  @RequirePermissions("alumni:manage")
  removeCareerHistory(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.alumni.removeCareerHistory(user.organizationId, id);
  }

  @Post("alumni-profiles/:id/skills")
  @RequirePermissions("alumni:manage")
  addSkill(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: CreateSkillDto) {
    return this.alumni.addSkill(user.organizationId, id, dto);
  }

  @Delete("alumni-skills/:id")
  @RequirePermissions("alumni:manage")
  removeSkill(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.alumni.removeSkill(user.organizationId, id);
  }

  @Post("alumni-profiles/:id/certifications")
  @RequirePermissions("alumni:manage")
  addCertification(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: CreateCertificationDto) {
    return this.alumni.addCertification(user.organizationId, id, dto);
  }

  @Delete("alumni-certifications/:id")
  @RequirePermissions("alumni:manage")
  removeCertification(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.alumni.removeCertification(user.organizationId, id);
  }
}
