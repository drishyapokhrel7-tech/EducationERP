import { BadRequestException, Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AnalyticsService } from "./analytics.service";
import { ExportTable, toCsv, toXlsx } from "./export-helpers";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me/analytics")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("operational")
  @RequirePermissions("analytics:view")
  operational(@CurrentUser() user: JwtPayload) {
    return this.analytics.operational(user.organizationId);
  }

  @Get("academic")
  @RequirePermissions("analytics:view")
  academic(@CurrentUser() user: JwtPayload, @Query("examId") examId?: string) {
    return this.analytics.academic(user.organizationId, examId);
  }

  @Get("attendance")
  @RequirePermissions("analytics:view")
  attendance(@CurrentUser() user: JwtPayload, @Query("from") from?: string, @Query("to") to?: string) {
    return this.analytics.attendance(user.organizationId, from, to);
  }

  @Get("enrollment")
  @RequirePermissions("analytics:view")
  enrollment(@CurrentUser() user: JwtPayload) {
    return this.analytics.enrollment(user.organizationId);
  }

  // ── Export — a dynamic (csv vs xlsx) content-type/filename can't be
  // expressed with NestJS's static @Header() decorator, so these use
  // @Res() directly (same pattern already established by
  // storage/local-files.controller.ts) and send the response body
  // themselves rather than returning a value for Nest to serialize.

  @Get("operational/export")
  @RequirePermissions("analytics:export")
  async exportOperational(@CurrentUser() user: JwtPayload, @Query("format") format: string, @Res() res: Response) {
    const table = await this.analytics.exportOperational(user.organizationId);
    await this.sendTable(res, table, "operational", format);
  }

  @Get("academic/export")
  @RequirePermissions("analytics:export")
  async exportAcademic(
    @CurrentUser() user: JwtPayload,
    @Query("format") format: string,
    @Res() res: Response,
    @Query("examId") examId?: string,
  ) {
    const table = await this.analytics.exportAcademic(user.organizationId, examId);
    await this.sendTable(res, table, "academic", format);
  }

  @Get("attendance/export")
  @RequirePermissions("analytics:export")
  async exportAttendance(
    @CurrentUser() user: JwtPayload,
    @Query("format") format: string,
    @Res() res: Response,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const table = await this.analytics.exportAttendance(user.organizationId, from, to);
    await this.sendTable(res, table, "attendance", format);
  }

  @Get("enrollment/export")
  @RequirePermissions("analytics:export")
  async exportEnrollment(@CurrentUser() user: JwtPayload, @Query("format") format: string, @Res() res: Response) {
    const table = await this.analytics.exportEnrollment(user.organizationId);
    await this.sendTable(res, table, "enrollment", format);
  }

  private async sendTable(res: Response, table: ExportTable, filenameBase: string, format: string) {
    if (format === "xlsx") {
      const buffer = await toXlsx(table, filenameBase);
      res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.set("Content-Disposition", `attachment; filename="${filenameBase}.xlsx"`);
      res.send(buffer);
      return;
    }
    if (format === "csv") {
      res.set("Content-Type", "text/csv");
      res.set("Content-Disposition", `attachment; filename="${filenameBase}.csv"`);
      res.send(toCsv(table));
      return;
    }
    throw new BadRequestException('format must be "csv" or "xlsx"');
  }
}
