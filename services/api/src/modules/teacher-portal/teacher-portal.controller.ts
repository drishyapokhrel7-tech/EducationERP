import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { TeacherPortalService } from "./teacher-portal.service";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";
import { CreateClassSessionDto } from "../class-sessions/dto/create-class-session.dto";
import { RecordProgressDto } from "../class-sessions/dto/record-progress.dto";
import { CreateClassMaterialDto } from "../class-sessions/dto/create-class-material.dto";

// Deliberately JwtAuthGuard only — no PermissionsGuard/@RequirePermissions,
// same reasoning as StudentPortalController/DriverPortalController:
// authorization comes entirely from the teacher being derived server-side
// from the caller's own linked Employee row, never from a request param.
@UseGuards(JwtAuthGuard)
@Controller("organizations/me/teacher-portal")
export class TeacherPortalController {
  constructor(private readonly teacherPortal: TeacherPortalService) {}

  @Get("me")
  getMe(@CurrentUser() user: JwtPayload) {
    return this.teacherPortal.getMe(user.organizationId, user.sub);
  }

  @Get("today")
  myClassesToday(@CurrentUser() user: JwtPayload, @Query("date") date: string) {
    return this.teacherPortal.myClassesToday(user.organizationId, user.sub, date);
  }

  @Post("class-sessions")
  createSession(@CurrentUser() user: JwtPayload, @Body() dto: CreateClassSessionDto) {
    return this.teacherPortal.createSession(user.organizationId, user.sub, dto);
  }

  @Get("class-sessions/:sessionId")
  getSession(@CurrentUser() user: JwtPayload, @Param("sessionId") sessionId: string) {
    return this.teacherPortal.getSession(user.organizationId, user.sub, sessionId);
  }

  @Get("class-sessions/:sessionId/syllabus-nodes")
  getSyllabusNodesForSession(@CurrentUser() user: JwtPayload, @Param("sessionId") sessionId: string) {
    return this.teacherPortal.getSyllabusNodesForSession(user.organizationId, user.sub, sessionId);
  }

  @Put("class-sessions/:sessionId/progress")
  recordProgress(
    @CurrentUser() user: JwtPayload,
    @Param("sessionId") sessionId: string,
    @Body() dto: RecordProgressDto,
  ) {
    return this.teacherPortal.recordProgress(user.organizationId, user.sub, sessionId, dto);
  }

  @Post("class-sessions/:sessionId/materials")
  addMaterial(
    @CurrentUser() user: JwtPayload,
    @Param("sessionId") sessionId: string,
    @Body() dto: CreateClassMaterialDto,
  ) {
    return this.teacherPortal.addMaterial(user.organizationId, user.sub, sessionId, dto);
  }

  @Post("class-sessions/:sessionId/complete")
  completeSession(@CurrentUser() user: JwtPayload, @Param("sessionId") sessionId: string) {
    return this.teacherPortal.completeSession(user.organizationId, user.sub, sessionId);
  }
}
