import { BadRequestException, Controller, Get, Post, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { DataSyncService } from "./data-sync.service";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";
import { IMPORT_UPLOAD_OPTIONS } from "../../common/upload-limits";

// The combined file can create/update records across five entities at
// once, so — unlike any single entity's own Excel routes — every route
// here requires the "create" (or "view"/"export" for read-only access)
// permission on ALL of them, not just one. A role scoped to a single
// entity (e.g. a nurse with only health_record permissions) correctly
// can't reach this combined shortcut into the others.
const WRITE_PERMISSIONS = [
  "student:create",
  "employee:create",
  "extracurricular_activity:create",
  "discipline_incident:create",
  "health_record:create",
];
const READ_PERMISSIONS = [
  "student:export",
  "employee:export",
  "extracurricular_activity:view",
  "discipline_incident:view",
  "health_record:view",
];

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me/data-sync")
export class DataSyncController {
  constructor(private readonly dataSync: DataSyncService) {}

  @Get("template")
  @RequirePermissions(...WRITE_PERMISSIONS)
  async downloadTemplate(@CurrentUser() user: JwtPayload, @Res() res: Response) {
    const buffer = await this.dataSync.generateCombinedTemplate(user.organizationId);
    res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.set("Content-Disposition", 'attachment; filename="erp-data-sync-template.xlsx"');
    res.send(buffer);
  }

  @Get("export-editable")
  @RequirePermissions(...READ_PERMISSIONS)
  async exportEditable(@CurrentUser() user: JwtPayload, @Res() res: Response) {
    const buffer = await this.dataSync.exportCombinedEditable(user.organizationId);
    res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.set("Content-Disposition", 'attachment; filename="erp-data-sync-editable.xlsx"');
    res.send(buffer);
  }

  @Post("import")
  @RequirePermissions(...WRITE_PERMISSIONS)
  @UseInterceptors(FileInterceptor("file", IMPORT_UPLOAD_OPTIONS))
  importCombined(@CurrentUser() user: JwtPayload, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException("No file uploaded (expected a multipart field named 'file')");
    return this.dataSync.importCombined(user.organizationId, user.sub, file.buffer, file.originalname);
  }
}
