import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { TimetableService } from "./timetable.service";
import { CreateRoomDto } from "./dto/create-room.dto";
import { UpdateRoomDto } from "./dto/update-room.dto";
import { CreatePeriodDto } from "./dto/create-period.dto";
import { UpdatePeriodDto } from "./dto/update-period.dto";
import { CreateTeachingAssignmentDto } from "./dto/create-teaching-assignment.dto";
import { CreateClassScheduleDto } from "./dto/create-class-schedule.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me")
export class TimetableController {
  constructor(private readonly timetable: TimetableService) {}

  @Get("rooms")
  @RequirePermissions("room:view")
  listRooms(@CurrentUser() user: JwtPayload) {
    return this.timetable.listRooms(user.organizationId);
  }

  @Post("rooms")
  @RequirePermissions("room:create")
  createRoom(@CurrentUser() user: JwtPayload, @Body() dto: CreateRoomDto) {
    return this.timetable.createRoom(user.organizationId, dto);
  }

  @Patch("rooms/:id")
  @RequirePermissions("room:update")
  updateRoom(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateRoomDto) {
    return this.timetable.updateRoom(user.organizationId, id, dto);
  }

  @Delete("rooms/:id")
  @RequirePermissions("room:delete")
  deleteRoom(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.timetable.deleteRoom(user.organizationId, id);
  }

  @Get("periods")
  @RequirePermissions("period:view")
  listPeriods(@CurrentUser() user: JwtPayload) {
    return this.timetable.listPeriods(user.organizationId);
  }

  @Post("periods")
  @RequirePermissions("period:create")
  createPeriod(@CurrentUser() user: JwtPayload, @Body() dto: CreatePeriodDto) {
    return this.timetable.createPeriod(user.organizationId, dto);
  }

  @Patch("periods/:id")
  @RequirePermissions("period:update")
  updatePeriod(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdatePeriodDto) {
    return this.timetable.updatePeriod(user.organizationId, id, dto);
  }

  @Delete("periods/:id")
  @RequirePermissions("period:delete")
  deletePeriod(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.timetable.deletePeriod(user.organizationId, id);
  }

  @Get("teaching-assignments")
  @RequirePermissions("teaching_assignment:view")
  listTeachingAssignments(@CurrentUser() user: JwtPayload) {
    return this.timetable.listTeachingAssignments(user.organizationId);
  }

  @Post("teaching-assignments")
  @RequirePermissions("teaching_assignment:create")
  createTeachingAssignment(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTeachingAssignmentDto,
  ) {
    return this.timetable.createTeachingAssignment(user.organizationId, dto);
  }

  @Get("class-schedules")
  @RequirePermissions("class_schedule:view")
  listClassSchedules(@CurrentUser() user: JwtPayload) {
    return this.timetable.listClassSchedules(user.organizationId);
  }

  @Post("class-schedules")
  @RequirePermissions("class_schedule:create")
  createClassSchedule(@CurrentUser() user: JwtPayload, @Body() dto: CreateClassScheduleDto) {
    return this.timetable.createClassSchedule(user.organizationId, dto);
  }
}
