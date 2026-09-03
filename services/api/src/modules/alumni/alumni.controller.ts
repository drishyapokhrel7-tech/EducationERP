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
import { CreateSurveyDto } from "./dto/create-survey.dto";
import { UpdateSurveyDto } from "./dto/update-survey.dto";
import { CreateMentorshipDto } from "./dto/create-mentorship.dto";
import { RespondMentorshipDto } from "./dto/respond-mentorship.dto";
import { CreateAchievementDto } from "./dto/create-achievement.dto";
import { CreateOpportunityDto } from "./dto/create-opportunity.dto";
import { ReviewOpportunityDto } from "./dto/review-opportunity.dto";
import { UpdateApplicationStatusDto } from "./dto/update-application-status.dto";
import { CreateCareerServiceDto } from "./dto/create-career-service.dto";
import { UpdateCareerServiceDto } from "./dto/update-career-service.dto";
import { SetGraduateOutcomeDto } from "./dto/set-graduate-outcome.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

import { RequireEditionGuard } from "../../common/auth/require-edition.guard";
import { RequireEdition } from "../../common/auth/require-edition.decorator";

@UseGuards(JwtAuthGuard, PermissionsGuard, RequireEditionGuard)
@RequireEdition("ULTRA")
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

  // ── Surveys (Phase 8 slice 8b) ────────────────────────────────────

  @Post("alumni-surveys")
  @RequirePermissions("alumni:create")
  createSurvey(@CurrentUser() user: JwtPayload, @Body() dto: CreateSurveyDto) {
    return this.alumni.createSurvey(user.organizationId, dto);
  }

  @Get("alumni-surveys")
  @RequirePermissions("alumni:view")
  listSurveys(@CurrentUser() user: JwtPayload) {
    return this.alumni.listSurveys(user.organizationId);
  }

  @Patch("alumni-surveys/:id")
  @RequirePermissions("alumni:manage")
  updateSurvey(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateSurveyDto) {
    return this.alumni.updateSurvey(user.organizationId, id, dto);
  }

  @Post("alumni-surveys/:id/publish")
  @RequirePermissions("alumni:manage")
  publishSurvey(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.alumni.publishSurvey(user.organizationId, id);
  }

  @Post("alumni-surveys/:id/close")
  @RequirePermissions("alumni:manage")
  closeSurvey(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.alumni.closeSurvey(user.organizationId, id);
  }

  @Get("alumni-surveys/:id/responses")
  @RequirePermissions("alumni:view")
  listSurveyResponses(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.alumni.listSurveyResponses(user.organizationId, id);
  }

  // ── Mentorship (Phase 8 slice 8b) ─────────────────────────────────

  @Post("alumni-mentorship")
  @RequirePermissions("alumni:create")
  createMentorship(@CurrentUser() user: JwtPayload, @Body() dto: CreateMentorshipDto) {
    return this.alumni.createMentorship(user.organizationId, dto);
  }

  @Get("alumni-mentorship")
  @RequirePermissions("alumni:view")
  listMentorships(@CurrentUser() user: JwtPayload) {
    return this.alumni.listMentorships(user.organizationId);
  }

  @Post("alumni-mentorship/:id/respond")
  @RequirePermissions("alumni:manage")
  respondMentorship(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: RespondMentorshipDto) {
    return this.alumni.respondMentorship(user.organizationId, id, dto);
  }

  @Post("alumni-mentorship/:id/complete")
  @RequirePermissions("alumni:manage")
  completeMentorship(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.alumni.completeMentorship(user.organizationId, id);
  }

  // ── Achievements ───────────────────────────────────────────────────

  @Post("alumni-profiles/:id/achievements")
  @RequirePermissions("alumni:manage")
  addAchievement(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: CreateAchievementDto) {
    return this.alumni.addAchievement(user.organizationId, id, dto);
  }

  @Delete("alumni-achievements/:id")
  @RequirePermissions("alumni:manage")
  removeAchievement(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.alumni.removeAchievement(user.organizationId, id);
  }

  // ── Career opportunities & applications (Phase 8 slice 8c) ────────

  @Post("career-opportunities")
  @RequirePermissions("alumni:create")
  createOpportunity(@CurrentUser() user: JwtPayload, @Body() dto: CreateOpportunityDto) {
    return this.alumni.createOpportunity(user.organizationId, dto);
  }

  @Get("career-opportunities")
  @RequirePermissions("alumni:view")
  listOpportunities(@CurrentUser() user: JwtPayload) {
    return this.alumni.listOpportunities(user.organizationId);
  }

  @Post("career-opportunities/:id/review")
  @RequirePermissions("alumni:manage")
  reviewOpportunity(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: ReviewOpportunityDto) {
    return this.alumni.reviewOpportunity(user.organizationId, id, dto);
  }

  @Post("career-opportunities/:id/close")
  @RequirePermissions("alumni:manage")
  closeOpportunity(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.alumni.closeOpportunity(user.organizationId, id);
  }

  @Get("career-opportunities/:id/applications")
  @RequirePermissions("alumni:view")
  listApplicationsForOpportunity(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.alumni.listApplicationsForOpportunity(user.organizationId, id);
  }

  @Patch("career-applications/:id")
  @RequirePermissions("alumni:manage")
  updateApplicationStatus(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateApplicationStatusDto) {
    return this.alumni.updateApplicationStatus(user.organizationId, id, dto);
  }

  // ── Career services ────────────────────────────────────────────────

  @Post("career-services")
  @RequirePermissions("alumni:create")
  createCareerService(@CurrentUser() user: JwtPayload, @Body() dto: CreateCareerServiceDto) {
    return this.alumni.createCareerService(user.organizationId, dto);
  }

  @Get("career-services")
  @RequirePermissions("alumni:view")
  listCareerServices(@CurrentUser() user: JwtPayload) {
    return this.alumni.listCareerServices(user.organizationId);
  }

  @Patch("career-services/:id")
  @RequirePermissions("alumni:manage")
  updateCareerService(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateCareerServiceDto) {
    return this.alumni.updateCareerService(user.organizationId, id, dto);
  }

  // ── Graduate outcomes ───────────────────────────────────────────────

  @Post("alumni-profiles/:id/graduate-outcome")
  @RequirePermissions("alumni:manage")
  setGraduateOutcome(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: SetGraduateOutcomeDto) {
    return this.alumni.setGraduateOutcome(user.organizationId, id, dto);
  }
}
