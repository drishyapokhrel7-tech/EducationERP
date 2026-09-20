import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { DisciplineService } from "./discipline.service";
import { CreateIncidentTypeDto } from "./dto/create-incident-type.dto";
import { UpdateIncidentTypeDto } from "./dto/update-incident-type.dto";
import { CreateIncidentDto } from "./dto/create-incident.dto";
import { UpdateIncidentDto } from "./dto/update-incident.dto";
import { ListIncidentsQueryDto } from "./dto/list-incidents.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me")
export class DisciplineController {
  constructor(private readonly discipline: DisciplineService) {}

  @Get("students/:studentId/discipline-incidents")
  @RequirePermissions("discipline_incident:view")
  listIncidents(@CurrentUser() user: JwtPayload, @Param("studentId") studentId: string) {
    return this.discipline.listIncidents(user.organizationId, studentId);
  }

  @Post("students/:studentId/discipline-incidents")
  @RequirePermissions("discipline_incident:create")
  createIncident(
    @CurrentUser() user: JwtPayload,
    @Param("studentId") studentId: string,
    @Body() dto: CreateIncidentDto,
  ) {
    return this.discipline.createIncident(user.organizationId, studentId, user.sub, dto);
  }

  // Org-wide, not per-student — filterable by student/severity.
  @Get("discipline-incidents")
  @RequirePermissions("discipline_incident:view")
  listAllIncidents(@CurrentUser() user: JwtPayload, @Query() filters: ListIncidentsQueryDto) {
    return this.discipline.listAllIncidents(user.organizationId, filters);
  }

  @Patch("discipline-incidents/:id")
  @RequirePermissions("discipline_incident:update")
  updateIncident(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateIncidentDto) {
    return this.discipline.updateIncident(user.organizationId, id, dto);
  }

  @Delete("discipline-incidents/:id")
  @RequirePermissions("discipline_incident:delete")
  deleteIncident(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.discipline.deleteIncident(user.organizationId, id);
  }

  @Post("discipline-incident-types")
  @RequirePermissions("discipline_incident:manage")
  createIncidentType(@CurrentUser() user: JwtPayload, @Body() dto: CreateIncidentTypeDto) {
    return this.discipline.createIncidentType(user.organizationId, dto);
  }

  @Get("discipline-incident-types")
  @RequirePermissions("discipline_incident:view")
  listIncidentTypes(@CurrentUser() user: JwtPayload) {
    return this.discipline.listIncidentTypes(user.organizationId);
  }

  @Patch("discipline-incident-types/:id")
  @RequirePermissions("discipline_incident:manage")
  updateIncidentType(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateIncidentTypeDto) {
    return this.discipline.updateIncidentType(user.organizationId, id, dto);
  }

  @Delete("discipline-incident-types/:id")
  @RequirePermissions("discipline_incident:manage")
  deleteIncidentType(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.discipline.deleteIncidentType(user.organizationId, id);
  }
}
