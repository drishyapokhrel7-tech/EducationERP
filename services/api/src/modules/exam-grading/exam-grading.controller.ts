import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ExamGradingService } from "./exam-grading.service";
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
}
