import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { TeacherPortalService } from "./teacher-portal.service";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";
import { CreateClassSessionDto } from "../class-sessions/dto/create-class-session.dto";
import { RecordProgressDto } from "../class-sessions/dto/record-progress.dto";
import { CreateClassMaterialDto } from "../class-sessions/dto/create-class-material.dto";
import { CreateCourseModuleDto } from "./dto/create-course-module.dto";
import { UpdateCourseModuleDto } from "./dto/update-course-module.dto";
import { CreateCourseModuleItemDto } from "./dto/create-course-module-item.dto";
import { UpdateCourseModuleItemDto } from "./dto/update-course-module-item.dto";
import { CreateAssignmentDto } from "../assignments/dto/create-assignment.dto";
import { UpdateAssignmentDto } from "../assignments/dto/update-assignment.dto";
import { GradeSubmissionDto } from "../assignments/dto/grade-submission.dto";

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

  @Get("modules")
  listModules(@CurrentUser() user: JwtPayload, @Query("teachingAssignmentId") teachingAssignmentId: string) {
    return this.teacherPortal.listModules(user.organizationId, user.sub, teachingAssignmentId);
  }

  @Post("modules")
  createModule(@CurrentUser() user: JwtPayload, @Body() dto: CreateCourseModuleDto) {
    return this.teacherPortal.createModule(user.organizationId, user.sub, dto);
  }

  @Put("modules/:moduleId")
  updateModule(
    @CurrentUser() user: JwtPayload,
    @Param("moduleId") moduleId: string,
    @Body() dto: UpdateCourseModuleDto,
  ) {
    return this.teacherPortal.updateModule(user.organizationId, user.sub, moduleId, dto);
  }

  @Post("modules/:moduleId/items")
  addModuleItem(
    @CurrentUser() user: JwtPayload,
    @Param("moduleId") moduleId: string,
    @Body() dto: CreateCourseModuleItemDto,
  ) {
    return this.teacherPortal.addModuleItem(user.organizationId, user.sub, moduleId, dto);
  }

  @Put("module-items/:itemId")
  updateModuleItem(
    @CurrentUser() user: JwtPayload,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateCourseModuleItemDto,
  ) {
    return this.teacherPortal.updateModuleItem(user.organizationId, user.sub, itemId, dto);
  }

  @Get("assignments")
  listAssignments(@CurrentUser() user: JwtPayload, @Query("teachingAssignmentId") teachingAssignmentId: string) {
    return this.teacherPortal.listAssignments(user.organizationId, user.sub, teachingAssignmentId);
  }

  @Post("assignments")
  createAssignment(@CurrentUser() user: JwtPayload, @Body() dto: CreateAssignmentDto) {
    return this.teacherPortal.createAssignment(user.organizationId, user.sub, dto);
  }

  @Get("assignments/:assignmentId")
  getAssignmentDetail(@CurrentUser() user: JwtPayload, @Param("assignmentId") assignmentId: string) {
    return this.teacherPortal.getAssignmentDetail(user.organizationId, user.sub, assignmentId);
  }

  @Put("assignments/:assignmentId")
  updateAssignment(
    @CurrentUser() user: JwtPayload,
    @Param("assignmentId") assignmentId: string,
    @Body() dto: UpdateAssignmentDto,
  ) {
    return this.teacherPortal.updateAssignment(user.organizationId, user.sub, assignmentId, dto);
  }

  @Put("assignments/:assignmentId/submissions/:studentId/grade")
  gradeSubmission(
    @CurrentUser() user: JwtPayload,
    @Param("assignmentId") assignmentId: string,
    @Param("studentId") studentId: string,
    @Body() dto: GradeSubmissionDto,
  ) {
    return this.teacherPortal.gradeSubmission(user.organizationId, user.sub, assignmentId, studentId, dto);
  }
}
