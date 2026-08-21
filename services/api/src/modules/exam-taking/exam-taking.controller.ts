import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { ExamTakingService } from "./exam-taking.service";
import { SaveAnswerDto } from "./dto/save-answer.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

// JwtAuthGuard only, same as StudentPortalController (slice 4e) — no
// PermissionsGuard/@RequirePermissions. studentId is always derived
// server-side from the caller's own linked Student row.
@UseGuards(JwtAuthGuard)
@Controller("organizations/me/portal/exams")
export class ExamTakingController {
  constructor(private readonly examTaking: ExamTakingService) {}

  @Get()
  listMyExams(@CurrentUser() user: JwtPayload) {
    return this.examTaking.listMyExams(user.organizationId, user.sub);
  }

  @Post(":examSubjectId/start")
  startExam(@CurrentUser() user: JwtPayload, @Param("examSubjectId") examSubjectId: string) {
    return this.examTaking.startExam(user.organizationId, user.sub, examSubjectId);
  }

  @Put(":examSubjectId/answers/:questionId")
  saveAnswer(
    @CurrentUser() user: JwtPayload,
    @Param("examSubjectId") examSubjectId: string,
    @Param("questionId") questionId: string,
    @Body() dto: SaveAnswerDto,
  ) {
    return this.examTaking.saveAnswer(user.organizationId, user.sub, examSubjectId, questionId, dto);
  }

  @Post(":examSubjectId/submit")
  submitExam(@CurrentUser() user: JwtPayload, @Param("examSubjectId") examSubjectId: string) {
    return this.examTaking.submitExam(user.organizationId, user.sub, examSubjectId);
  }
}
