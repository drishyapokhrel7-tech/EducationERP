import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
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
import { IMPORT_UPLOAD_OPTIONS } from "../../common/upload-limits";

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

  @Post("discipline-incidents/import")
  @RequirePermissions("discipline_incident:create")
  @UseInterceptors(FileInterceptor("file", IMPORT_UPLOAD_OPTIONS))
  importIncidents(@CurrentUser() user: JwtPayload, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException("No file uploaded (expected a multipart field named 'file')");
    return this.discipline.importIncidents(user.organizationId, user.sub, file.buffer, file.originalname);
  }

  @Get("discipline-incidents/import-template")
  @RequirePermissions("discipline_incident:create")
  async downloadIncidentImportTemplate(@CurrentUser() user: JwtPayload, @Res() res: Response) {
    const buffer = await this.discipline.generateIncidentImportTemplate(user.organizationId);
    res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.set("Content-Disposition", 'attachment; filename="discipline-incidents-import-template.xlsx"');
    res.send(buffer);
  }

  @Get("discipline-incidents/export-editable")
  @RequirePermissions("discipline_incident:view")
  async exportEditableIncidents(@CurrentUser() user: JwtPayload, @Res() res: Response) {
    const buffer = await this.discipline.exportEditableIncidents(user.organizationId);
    res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.set("Content-Disposition", 'attachment; filename="discipline-incidents-editable.xlsx"');
    res.send(buffer);
  }
}
