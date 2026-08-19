import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { AttendanceService } from "./attendance.service";
import { CreateAttendanceSessionDto } from "./dto/create-attendance-session.dto";
import { MarkAttendanceDto } from "./dto/mark-attendance.dto";
import { CorrectAttendanceDto } from "./dto/correct-attendance.dto";
import { CreateStaffAttendanceDto } from "./dto/create-staff-attendance.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me")
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get("attendance-sessions")
  @RequirePermissions("attendance:view")
  listSessions(@CurrentUser() user: JwtPayload) {
    return this.attendance.listSessions(user.organizationId);
  }

  @Post("attendance-sessions")
  @RequirePermissions("attendance:create")
  createSession(@CurrentUser() user: JwtPayload, @Body() dto: CreateAttendanceSessionDto) {
    return this.attendance.createSession(user.organizationId, dto);
  }

  @Get("attendance-sessions/:sessionId")
  @RequirePermissions("attendance:view")
  getSession(@CurrentUser() user: JwtPayload, @Param("sessionId") sessionId: string) {
    return this.attendance.getSession(user.organizationId, sessionId);
  }

  @Post("attendance-sessions/:sessionId/mark")
  @RequirePermissions("attendance:manage")
  markAttendance(
    @CurrentUser() user: JwtPayload,
    @Param("sessionId") sessionId: string,
    @Body() dto: MarkAttendanceDto,
  ) {
    return this.attendance.markAttendance(user.organizationId, sessionId, dto);
  }

  @Put("attendance-sessions/:sessionId/students/:studentId")
  @RequirePermissions("attendance:manage")
  correctAttendance(
    @CurrentUser() user: JwtPayload,
    @Param("sessionId") sessionId: string,
    @Param("studentId") studentId: string,
    @Body() dto: CorrectAttendanceDto,
  ) {
    return this.attendance.correctAttendance(user.organizationId, sessionId, studentId, dto);
  }

  @Get("staff-attendance")
  @RequirePermissions("staff_attendance:view")
  listStaffAttendance(@CurrentUser() user: JwtPayload) {
    return this.attendance.listStaffAttendance(user.organizationId);
  }

  @Post("staff-attendance")
  @RequirePermissions("staff_attendance:create")
  markStaffAttendance(@CurrentUser() user: JwtPayload, @Body() dto: CreateStaffAttendanceDto) {
    return this.attendance.markStaffAttendance(user.organizationId, dto);
  }
}
