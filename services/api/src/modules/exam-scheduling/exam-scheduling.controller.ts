import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ExamSchedulingService } from "./exam-scheduling.service";
import { CreateExamDto } from "./dto/create-exam.dto";
import { CreateExamSubjectDto } from "./dto/create-exam-subject.dto";
import { CreateExamScheduleDto } from "./dto/create-exam-schedule.dto";
import { CreateExamRoomDto } from "./dto/create-exam-room.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me")
export class ExamSchedulingController {
  constructor(private readonly examScheduling: ExamSchedulingService) {}

  @Get("exams")
  @RequirePermissions("exam:view")
  listExams(@CurrentUser() user: JwtPayload) {
    return this.examScheduling.listExams(user.organizationId);
  }

  @Post("exams")
  @RequirePermissions("exam:create")
  createExam(@CurrentUser() user: JwtPayload, @Body() dto: CreateExamDto) {
    return this.examScheduling.createExam(user.organizationId, dto);
  }

  @Get("exams/:examId")
  @RequirePermissions("exam:view")
  getExam(@CurrentUser() user: JwtPayload, @Param("examId") examId: string) {
    return this.examScheduling.getExam(user.organizationId, examId);
  }

  @Post("exams/:examId/subjects")
  @RequirePermissions("exam_subject:create")
  addExamSubject(
    @CurrentUser() user: JwtPayload,
    @Param("examId") examId: string,
    @Body() dto: CreateExamSubjectDto,
  ) {
    return this.examScheduling.addExamSubject(user.organizationId, examId, dto);
  }

  @Post("exam-subjects/:examSubjectId/schedule")
  @RequirePermissions("exam_schedule:create")
  createExamSchedule(
    @CurrentUser() user: JwtPayload,
    @Param("examSubjectId") examSubjectId: string,
    @Body() dto: CreateExamScheduleDto,
  ) {
    return this.examScheduling.createExamSchedule(user.organizationId, examSubjectId, dto);
  }

  @Post("exam-schedules/:examScheduleId/rooms")
  @RequirePermissions("exam_room:create")
  addExamRoom(
    @CurrentUser() user: JwtPayload,
    @Param("examScheduleId") examScheduleId: string,
    @Body() dto: CreateExamRoomDto,
  ) {
    return this.examScheduling.addExamRoom(user.organizationId, examScheduleId, dto);
  }
}
