import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { LeaveRequestStatus } from "@prisma/client";
import { LeaveService } from "./leave.service";
import { CreateLeaveTypeDto } from "./dto/create-leave-type.dto";
import { UpdateLeaveTypeDto } from "./dto/update-leave-type.dto";
import { AllocateLeaveBalanceDto } from "./dto/allocate-leave-balance.dto";
import { CreateLeaveRequestDto } from "./dto/create-leave-request.dto";
import { ReviewLeaveRequestDto } from "./dto/review-leave-request.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

import { RequireEditionGuard } from "../../common/auth/require-edition.guard";
import { RequireEdition } from "../../common/auth/require-edition.decorator";

@UseGuards(JwtAuthGuard, PermissionsGuard, RequireEditionGuard)
@RequireEdition("PROFESSIONAL")
@Controller("organizations/me")
export class LeaveController {
  constructor(private readonly leave: LeaveService) {}

  @Post("leave-types")
  @RequirePermissions("leave_type:create")
  createLeaveType(@CurrentUser() user: JwtPayload, @Body() dto: CreateLeaveTypeDto) {
    return this.leave.createLeaveType(user.organizationId, dto);
  }

  @Get("leave-types")
  @RequirePermissions("leave_type:view")
  listLeaveTypes(@CurrentUser() user: JwtPayload) {
    return this.leave.listLeaveTypes(user.organizationId);
  }

  @Patch("leave-types/:id")
  @RequirePermissions("leave_type:update")
  updateLeaveType(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateLeaveTypeDto) {
    return this.leave.updateLeaveType(user.organizationId, id, dto);
  }

  @Delete("leave-types/:id")
  @RequirePermissions("leave_type:delete")
  deleteLeaveType(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.leave.deleteLeaveType(user.organizationId, id);
  }

  @Post("leave-balances")
  @RequirePermissions("leave_request:manage")
  allocateBalance(@CurrentUser() user: JwtPayload, @Body() dto: AllocateLeaveBalanceDto) {
    return this.leave.allocateBalance(user.organizationId, dto);
  }

  @Get("employees/:id/leave-balances")
  @RequirePermissions("leave_request:view")
  listEmployeeBalances(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.leave.listEmployeeBalances(user.organizationId, id);
  }

  @Get("leave-requests")
  @RequirePermissions("leave_request:view")
  listLeaveRequests(
    @CurrentUser() user: JwtPayload,
    @Query("employeeId") employeeId?: string,
    @Query("status") status?: LeaveRequestStatus,
  ) {
    return this.leave.listLeaveRequests(user.organizationId, { employeeId, status });
  }

  @Post("leave-requests")
  @RequirePermissions("leave_request:create")
  createLeaveRequest(@CurrentUser() user: JwtPayload, @Body() dto: CreateLeaveRequestDto) {
    return this.leave.createLeaveRequest(user.organizationId, dto);
  }

  @Post("leave-requests/:id/approve")
  @RequirePermissions("leave_request:approve")
  approveLeaveRequest(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.leave.approveLeaveRequest(user.organizationId, user.sub, id);
  }

  @Post("leave-requests/:id/reject")
  @RequirePermissions("leave_request:approve")
  rejectLeaveRequest(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: ReviewLeaveRequestDto) {
    return this.leave.rejectLeaveRequest(user.organizationId, user.sub, id, dto);
  }

  @Post("leave-requests/:id/cancel")
  @RequirePermissions("leave_request:manage")
  cancelLeaveRequest(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.leave.cancelLeaveRequest(user.organizationId, user.sub, id);
  }
}
