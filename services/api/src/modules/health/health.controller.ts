import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
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
import { IMPORT_UPLOAD_OPTIONS } from "../../common/upload-limits";

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

  @Post("health-visits/import")
  @RequirePermissions("health_record:create")
  @UseInterceptors(FileInterceptor("file", IMPORT_UPLOAD_OPTIONS))
  importVisits(@CurrentUser() user: JwtPayload, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException("No file uploaded (expected a multipart field named 'file')");
    return this.health.importVisits(user.organizationId, user.sub, file.buffer, file.originalname);
  }

  @Get("health-visits/import-template")
  @RequirePermissions("health_record:create")
  async downloadVisitImportTemplate(@Res() res: Response) {
    const buffer = await this.health.generateVisitImportTemplate();
    res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.set("Content-Disposition", 'attachment; filename="health-visits-import-template.xlsx"');
    res.send(buffer);
  }

  @Get("health-visits/export-editable")
  @RequirePermissions("health_record:view")
  async exportEditableVisits(@CurrentUser() user: JwtPayload, @Res() res: Response) {
    const buffer = await this.health.exportEditableVisits(user.organizationId);
    res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.set("Content-Disposition", 'attachment; filename="health-visits-editable.xlsx"');
    res.send(buffer);
  }
}
