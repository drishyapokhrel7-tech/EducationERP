import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { HealthService } from "./health.service";
import { UpdateHealthProfileDto } from "./dto/update-health-profile.dto";
import { CreateHealthVisitDto } from "./dto/create-health-visit.dto";
import { UpdateHealthVisitDto } from "./dto/update-health-visit.dto";
import { ListHealthVisitsQueryDto } from "./dto/list-health-visits.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get("students/:studentId/health-profile")
  @RequirePermissions("health_record:view")
  getHealthProfile(@CurrentUser() user: JwtPayload, @Param("studentId") studentId: string) {
    return this.health.getHealthProfile(user.organizationId, studentId);
  }

  @Put("students/:studentId/health-profile")
  @RequirePermissions("health_record:update")
  updateHealthProfile(
    @CurrentUser() user: JwtPayload,
    @Param("studentId") studentId: string,
    @Body() dto: UpdateHealthProfileDto,
  ) {
    return this.health.updateHealthProfile(user.organizationId, studentId, dto);
  }

  @Get("students/:studentId/health-visits")
  @RequirePermissions("health_record:view")
  listHealthVisits(@CurrentUser() user: JwtPayload, @Param("studentId") studentId: string) {
    return this.health.listHealthVisits(user.organizationId, studentId);
  }

  @Post("students/:studentId/health-visits")
  @RequirePermissions("health_record:create")
  createHealthVisit(
    @CurrentUser() user: JwtPayload,
    @Param("studentId") studentId: string,
    @Body() dto: CreateHealthVisitDto,
  ) {
    return this.health.createHealthVisit(user.organizationId, studentId, user.sub, dto);
  }

  // Org-wide, not per-student — optionally filtered by student.
  @Get("health-visits")
  @RequirePermissions("health_record:view")
  listAllHealthVisits(@CurrentUser() user: JwtPayload, @Query() filters: ListHealthVisitsQueryDto) {
    return this.health.listAllHealthVisits(user.organizationId, filters);
  }

  @Patch("health-visits/:id")
  @RequirePermissions("health_record:update")
  updateHealthVisit(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateHealthVisitDto) {
    return this.health.updateHealthVisit(user.organizationId, id, dto);
  }

  @Delete("health-visits/:id")
  @RequirePermissions("health_record:delete")
  deleteHealthVisit(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.health.deleteHealthVisit(user.organizationId, id);
  }
}
