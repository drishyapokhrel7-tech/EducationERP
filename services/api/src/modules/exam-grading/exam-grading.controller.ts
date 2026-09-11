import { Controller, Get, Param, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ExamGradingService } from "./exam-grading.service";
import { buildReportCardPdf } from "./report-card-document";
import { buildAdmitCardPdf } from "./admit-card-document";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me")
export class ExamGradingController {
  constructor(private readonly examGrading: ExamGradingService) {}

  @Post("exam-attempts/:examAttemptId/grade")
  @RequirePermissions("grade:create")
  computeGrade(@CurrentUser() user: JwtPayload, @Param("examAttemptId") examAttemptId: string) {
    return this.examGrading.computeGrade(user.organizationId, examAttemptId);
  }

  @Post("exams/:examId/students/:studentId/report-card")
  @RequirePermissions("report_card:create")
  generateReportCard(
    @CurrentUser() user: JwtPayload,
    @Param("examId") examId: string,
    @Param("studentId") studentId: string,
  ) {
    return this.examGrading.generateReportCard(user.organizationId, examId, studentId);
  }

  @Get("exams/:examId/students/:studentId/report-card")
  @RequirePermissions("report_card:view")
  getReportCard(
    @CurrentUser() user: JwtPayload,
    @Param("examId") examId: string,
    @Param("studentId") studentId: string,
  ) {
    return this.examGrading.getReportCard(user.organizationId, examId, studentId);
  }

  // Printable report card — org letterhead, per-subject marks/grades
  // table, totals + overall grade/GPA, teacher remarks. @Res() because
  // a Buffer return is corrupted by Nest's JSON serializer.
  @Get("exams/:examId/students/:studentId/report-card/pdf")
  @RequirePermissions("report_card:view")
  async getReportCardPdf(
    @CurrentUser() user: JwtPayload,
    @Param("examId") examId: string,
    @Param("studentId") studentId: string,
    @Res() res: Response,
  ) {
    const data = await this.examGrading.getReportCardDocument(user.organizationId, examId, studentId);
    const pdf = await buildReportCardPdf(data.org, data);
    res.set("Content-Type", "application/pdf");
    res.set("Content-Disposition", `inline; filename="report-card-${data.student.studentCode}.pdf"`);
    res.send(pdf);
  }

  // Printable admit card / hall ticket — every subject the student is
  // registered for in this exam, each with its schedule and room(s).
  // exam:view (same as opening the exam), @Res() for the Buffer.
  @Get("exams/:examId/students/:studentId/admit-card")
  @RequirePermissions("exam:view")
  async getAdmitCardPdf(
    @CurrentUser() user: JwtPayload,
    @Param("examId") examId: string,
    @Param("studentId") studentId: string,
    @Res() res: Response,
  ) {
    const data = await this.examGrading.getAdmitCardDocument(user.organizationId, examId, studentId);
    const pdf = await buildAdmitCardPdf(data.org, data);
    res.set("Content-Type", "application/pdf");
    res.set("Content-Disposition", `inline; filename="admit-card-${data.student.studentCode}.pdf"`);
    res.send(pdf);
  }
}
