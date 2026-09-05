import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ExamEvaluationService } from "./exam-evaluation.service";
import { RecordExamAttemptDto } from "./dto/record-exam-attempt.dto";
import { RecordMarksDto } from "./dto/record-marks.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me")
export class ExamEvaluationController {
  constructor(private readonly examEvaluation: ExamEvaluationService) {}

  @Get("exam-subjects/:examSubjectId/attempts")
  @RequirePermissions("exam_attempt:view")
  listAttempts(@CurrentUser() user: JwtPayload, @Param("examSubjectId") examSubjectId: string) {
    return this.examEvaluation.listAttempts(user.organizationId, examSubjectId);
  }

  @Post("exam-subjects/:examSubjectId/attempts")
  @RequirePermissions("exam_attempt:create")
  recordAttempt(
    @CurrentUser() user: JwtPayload,
    @Param("examSubjectId") examSubjectId: string,
    @Body() dto: RecordExamAttemptDto,
  ) {
    return this.examEvaluation.recordAttempt(user.organizationId, examSubjectId, dto);
  }

  @Post("exam-attempts/:examAttemptId/marks")
  @RequirePermissions("marks:create")
  recordMarks(
    @CurrentUser() user: JwtPayload,
    @Param("examAttemptId") examAttemptId: string,
    @Body() dto: RecordMarksDto,
  ) {
    return this.examEvaluation.recordMarks(user.organizationId, examAttemptId, dto);
  }

  @Get("exam-attempts/:examAttemptId/answers")
  @RequirePermissions("exam_attempt:view")
  listAnswers(@CurrentUser() user: JwtPayload, @Param("examAttemptId") examAttemptId: string) {
    return this.examEvaluation.listAnswers(user.organizationId, examAttemptId);
  }
}
