import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AnalyticsService } from "./analytics.service";
import { ExportTable } from "./export-helpers";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";
import { PrismaService } from "../../prisma/prisma.service";
import { sendTableResponse } from "../../common/send-table";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me/analytics")
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly prisma: PrismaService,
  ) {}

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

  @Get("financial")
  @RequirePermissions("analytics:view")
  financial(@CurrentUser() user: JwtPayload) {
    return this.analytics.financial(user.organizationId);
  }

  @Get("examination")
  @RequirePermissions("analytics:view")
  examination(@CurrentUser() user: JwtPayload) {
    return this.analytics.examination(user.organizationId);
  }

  @Get("continuous-learning")
  @RequirePermissions("analytics:view")
  continuousLearning(@CurrentUser() user: JwtPayload) {
    return this.analytics.continuousLearning(user.organizationId);
  }

  @Get("alumni-outcomes")
  @RequirePermissions("analytics:view")
  alumniOutcomes(@CurrentUser() user: JwtPayload) {
    return this.analytics.alumniOutcomes(user.organizationId);
  }

  @Get("receivable-aging")
  @RequirePermissions("analytics:view")
  receivableAging(@CurrentUser() user: JwtPayload) {
    return this.analytics.receivableAging(user.organizationId);
  }

  // ── Export — a dynamic (csv vs xlsx vs pdf) content-type/filename
  // can't be expressed with NestJS's static @Header() decorator, so
  // these use @Res() directly (same pattern already established by
  // storage/local-files.controller.ts) and send the response body
  // themselves rather than returning a value for Nest to serialize.

  @Get("operational/export")
  @RequirePermissions("analytics:export")
  async exportOperational(@CurrentUser() user: JwtPayload, @Query("format") format: string, @Res() res: Response) {
    const table = await this.analytics.exportOperational(user.organizationId);
    await this.sendTable(res, table, "operational", "Operational Analytics", format, user);
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
    await this.sendTable(res, table, "academic", "Academic Analytics", format, user);
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
    await this.sendTable(res, table, "attendance", "Attendance Analytics", format, user);
  }

  @Get("enrollment/export")
  @RequirePermissions("analytics:export")
  async exportEnrollment(@CurrentUser() user: JwtPayload, @Query("format") format: string, @Res() res: Response) {
    const table = await this.analytics.exportEnrollment(user.organizationId);
    await this.sendTable(res, table, "enrollment", "Enrollment Analytics", format, user);
  }

  @Get("financial/export")
  @RequirePermissions("analytics:export")
  async exportFinancial(@CurrentUser() user: JwtPayload, @Query("format") format: string, @Res() res: Response) {
    const table = await this.analytics.exportFinancial(user.organizationId);
    await this.sendTable(res, table, "financial", "Financial Analytics", format, user);
  }

  @Get("examination/export")
  @RequirePermissions("analytics:export")
  async exportExamination(@CurrentUser() user: JwtPayload, @Query("format") format: string, @Res() res: Response) {
    const table = await this.analytics.exportExamination(user.organizationId);
    await this.sendTable(res, table, "examination", "Examination Analytics", format, user);
  }

  @Get("continuous-learning/export")
  @RequirePermissions("analytics:export")
  async exportContinuousLearning(@CurrentUser() user: JwtPayload, @Query("format") format: string, @Res() res: Response) {
    const table = await this.analytics.exportContinuousLearning(user.organizationId);
    await this.sendTable(res, table, "continuous-learning", "Continuous Learning Analytics", format, user);
  }

  @Get("alumni-outcomes/export")
  @RequirePermissions("analytics:export")
  async exportAlumniOutcomes(@CurrentUser() user: JwtPayload, @Query("format") format: string, @Res() res: Response) {
    const table = await this.analytics.exportAlumniOutcomes(user.organizationId);
    await this.sendTable(res, table, "alumni-outcomes", "Alumni & Graduate Outcomes Analytics", format, user);
  }

  @Get("receivable-aging/export")
  @RequirePermissions("analytics:export")
  async exportReceivableAging(@CurrentUser() user: JwtPayload, @Query("format") format: string, @Res() res: Response) {
    const table = await this.analytics.exportReceivableAging(user.organizationId);
    await this.sendTable(res, table, "receivable-aging", "Receivable Aging", format, user);
  }

  // Also writes the "a report was exported" audit-log signal the
  // dashboard's first-week checklist reads (resource "analytics",
  // action "analytics.report_exported") — deliberately on export, not
  // on any of the view endpoints above: this page loads all 8 reports
  // on mount with no tabs gating them, so a view-based signal would be
  // trivially true the instant anyone opens the page. Exporting is a
  // real, deliberate action.
  private async sendTable(
    res: Response,
    table: ExportTable,
    filenameBase: string,
    title: string,
    format: string,
    user: JwtPayload,
  ) {
    // The format-switch itself now lives in the shared
    // sendTableResponse (services/api/src/common/send-table.ts) —
    // AccountingController's report exports reuse it too. This
    // wrapper stays here since the audit-log signal is
    // analytics-specific (see the comment above).
    await sendTableResponse(res, table, filenameBase, title, format);
    await this.logExport(user.organizationId, user.sub, filenameBase, format);
  }

  private logExport(organizationId: string, userId: string, report: string, format: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.auditLog.create({
        data: {
          organizationId,
          userId,
          action: "analytics.report_exported",
          resource: "analytics",
          metadata: { report, format },
        },
      }),
    );
  }
}
