import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { HostelLookupKind } from "@prisma/client";
import { HostelService } from "./hostel.service";
import { CreateHostelDto } from "./dto/create-hostel.dto";
import { CreateBuildingDto } from "./dto/create-building.dto";
import { CreateRoomDto } from "./dto/create-room.dto";
import { CreateBedDto } from "./dto/create-bed.dto";
import { UpdateBedDto } from "./dto/update-bed.dto";
import { AllocateBedDto } from "./dto/allocate-bed.dto";
import { MarkAttendanceDto } from "./dto/mark-attendance.dto";
import { LogVisitorDto } from "./dto/log-visitor.dto";
import { CreateComplaintDto } from "./dto/create-complaint.dto";
import { UpdateComplaintDto } from "./dto/update-complaint.dto";
import { CreateMaintenanceRequestDto } from "./dto/create-maintenance-request.dto";
import { UpdateMaintenanceRequestDto } from "./dto/update-maintenance-request.dto";
import { CreateLookupDto } from "./dto/create-lookup.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me")
export class HostelController {
  constructor(private readonly hostel: HostelService) {}

  @Post("hostels")
  @RequirePermissions("hostel:create")
  createHostel(@CurrentUser() user: JwtPayload, @Body() dto: CreateHostelDto) {
    return this.hostel.createHostel(user.organizationId, dto);
  }

  @Get("hostels")
  @RequirePermissions("hostel:view")
  listHostels(@CurrentUser() user: JwtPayload) {
    return this.hostel.listHostels(user.organizationId);
  }

  @Post("hostel-buildings")
  @RequirePermissions("hostel:manage")
  createBuilding(@CurrentUser() user: JwtPayload, @Body() dto: CreateBuildingDto) {
    return this.hostel.createBuilding(user.organizationId, dto);
  }

  @Post("hostel-rooms")
  @RequirePermissions("hostel:manage")
  createRoom(@CurrentUser() user: JwtPayload, @Body() dto: CreateRoomDto) {
    return this.hostel.createRoom(user.organizationId, dto);
  }

  @Post("hostel-beds")
  @RequirePermissions("hostel:manage")
  createBed(@CurrentUser() user: JwtPayload, @Body() dto: CreateBedDto) {
    return this.hostel.createBed(user.organizationId, dto);
  }

  @Get("hostel-beds/vacant")
  @RequirePermissions("hostel:view")
  listVacantBeds(@CurrentUser() user: JwtPayload) {
    return this.hostel.listVacantBeds(user.organizationId);
  }

  @Patch("hostel-beds/:id")
  @RequirePermissions("hostel:manage")
  updateBed(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateBedDto) {
    return this.hostel.updateBed(user.organizationId, id, dto);
  }

  @Post("hostel-allocations")
  @RequirePermissions("hostel:manage")
  allocateBed(@CurrentUser() user: JwtPayload, @Body() dto: AllocateBedDto) {
    return this.hostel.allocateBed(user.organizationId, dto);
  }

  @Get("hostel-allocations")
  @RequirePermissions("hostel:view")
  listAllocations(@CurrentUser() user: JwtPayload) {
    return this.hostel.listAllocations(user.organizationId);
  }

  @Delete("hostel-allocations/:studentEnrollmentId")
  @RequirePermissions("hostel:manage")
  unallocateBed(@CurrentUser() user: JwtPayload, @Param("studentEnrollmentId") studentEnrollmentId: string) {
    return this.hostel.unallocateBed(user.organizationId, studentEnrollmentId);
  }

  @Post("hostel-allocations/:id/attendance")
  @RequirePermissions("hostel:manage")
  markAttendance(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: MarkAttendanceDto) {
    return this.hostel.markAttendance(user.organizationId, id, dto);
  }

  @Get("hostel-allocations/:id/attendance")
  @RequirePermissions("hostel:view")
  listAttendance(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.hostel.listAttendance(user.organizationId, id);
  }

  @Post("hostel-allocations/:id/visitors")
  @RequirePermissions("hostel:manage")
  logVisitorIn(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: LogVisitorDto) {
    return this.hostel.logVisitorIn(user.organizationId, id, dto);
  }

  @Patch("hostel-visitors/:visitorId/checkout")
  @RequirePermissions("hostel:manage")
  logVisitorOut(@CurrentUser() user: JwtPayload, @Param("visitorId") visitorId: string) {
    return this.hostel.logVisitorOut(user.organizationId, visitorId);
  }

  @Get("hostel-allocations/:id/visitors")
  @RequirePermissions("hostel:view")
  listVisitors(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.hostel.listVisitors(user.organizationId, id);
  }

  @Post("hostel-allocations/:id/complaints")
  @RequirePermissions("hostel:manage")
  createComplaint(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: CreateComplaintDto) {
    return this.hostel.createComplaint(user.organizationId, id, dto);
  }

  @Get("hostel-complaints")
  @RequirePermissions("hostel:view")
  listComplaints(@CurrentUser() user: JwtPayload) {
    return this.hostel.listComplaints(user.organizationId);
  }

  @Patch("hostel-complaints/:id")
  @RequirePermissions("hostel:manage")
  updateComplaint(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateComplaintDto) {
    return this.hostel.updateComplaint(user.organizationId, id, dto);
  }

  @Post("hostel-maintenance")
  @RequirePermissions("hostel:manage")
  createMaintenanceRequest(@CurrentUser() user: JwtPayload, @Body() dto: CreateMaintenanceRequestDto) {
    return this.hostel.createMaintenanceRequest(user.organizationId, dto);
  }

  @Get("hostel-maintenance")
  @RequirePermissions("hostel:view")
  listMaintenanceRequests(@CurrentUser() user: JwtPayload) {
    return this.hostel.listMaintenanceRequests(user.organizationId);
  }

  @Patch("hostel-maintenance/:id")
  @RequirePermissions("hostel:manage")
  updateMaintenanceRequest(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateMaintenanceRequestDto) {
    return this.hostel.updateMaintenanceRequest(user.organizationId, id, dto);
  }

  @Post("hostel-lookups")
  @RequirePermissions("hostel:manage")
  createLookup(@CurrentUser() user: JwtPayload, @Body() dto: CreateLookupDto) {
    return this.hostel.createLookup(user.organizationId, dto);
  }

  @Get("hostel-lookups")
  @RequirePermissions("hostel:view")
  listLookups(@CurrentUser() user: JwtPayload, @Query("kind") kind?: HostelLookupKind) {
    return this.hostel.listLookups(user.organizationId, kind);
  }
}
