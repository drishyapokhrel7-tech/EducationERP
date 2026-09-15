import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { GuardianPortalService } from "./guardian-portal.service";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";
import { AskGuardianQuestionDto } from "./dto/ask-guardian-question.dto";

// Deliberately JwtAuthGuard only — no PermissionsGuard/@RequirePermissions.
// Same reasoning as StudentPortalController/TeacherPortalController:
// authorization comes entirely from the guardianId being derived
// server-side from the caller's own linked Guardian row, and from
// assertOwnChild checking every studentId against that guardian's real
// StudentGuardian links — not from a permission string.
@UseGuards(JwtAuthGuard)
@Controller("organizations/me/guardian-portal")
export class GuardianPortalController {
  constructor(private readonly guardianPortal: GuardianPortalService) {}

  @Get("me")
  getMe(@CurrentUser() user: JwtPayload) {
    return this.guardianPortal.getMe(user.organizationId, user.sub);
  }

  @Get("children")
  listMyChildren(@CurrentUser() user: JwtPayload) {
    return this.guardianPortal.listMyChildren(user.organizationId, user.sub);
  }

  @Get("children/:studentId/schedule")
  getChildScheduleForDate(
    @CurrentUser() user: JwtPayload,
    @Param("studentId") studentId: string,
    @Query("date") date: string,
  ) {
    return this.guardianPortal.getChildScheduleForDate(user.organizationId, user.sub, studentId, date);
  }

  @Get("children/:studentId/quizzes")
  listChildQuizzes(@CurrentUser() user: JwtPayload, @Param("studentId") studentId: string) {
    return this.guardianPortal.listChildQuizzes(user.organizationId, user.sub, studentId);
  }

  @Get("children/:studentId/teaching-assignments")
  listChildTeachingAssignments(@CurrentUser() user: JwtPayload, @Param("studentId") studentId: string) {
    return this.guardianPortal.listChildTeachingAssignments(user.organizationId, user.sub, studentId);
  }

  @Post("children/:studentId/questions")
  askQuestion(
    @CurrentUser() user: JwtPayload,
    @Param("studentId") studentId: string,
    @Body() dto: AskGuardianQuestionDto,
  ) {
    return this.guardianPortal.askQuestion(user.organizationId, user.sub, studentId, dto);
  }

  @Get("questions")
  listMyQuestions(@CurrentUser() user: JwtPayload, @Query("studentId") studentId?: string) {
    return this.guardianPortal.listMyQuestions(user.organizationId, user.sub, studentId);
  }
}
