import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { DashboardsService } from "./dashboards.service";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me/dashboards")
export class DashboardsController {
  constructor(private readonly dashboards: DashboardsService) {}

  @Get("teacher/:employeeId")
  @RequirePermissions("dashboard:view")
  teacherDashboard(@CurrentUser() user: JwtPayload, @Param("employeeId") employeeId: string) {
    return this.dashboards.teacherDashboard(user.organizationId, employeeId);
  }

  @Get("student/:studentId")
  @RequirePermissions("dashboard:view")
  studentDashboard(@CurrentUser() user: JwtPayload, @Param("studentId") studentId: string) {
    return this.dashboards.studentDashboard(user.organizationId, studentId);
  }

  @Get("parent/:guardianId")
  @RequirePermissions("dashboard:view")
  parentDashboard(@CurrentUser() user: JwtPayload, @Param("guardianId") guardianId: string) {
    return this.dashboards.parentDashboard(user.organizationId, guardianId);
  }
}
