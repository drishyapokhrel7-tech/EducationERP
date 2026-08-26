import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { DriverPortalService } from "./driver-portal.service";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";
import { SubmitTrackingDto } from "./dto/submit-tracking.dto";

// Deliberately JwtAuthGuard only — no PermissionsGuard/@RequirePermissions,
// same reasoning as StudentPortalController: authorization comes entirely
// from the driver being derived server-side from the caller's own linked
// Employee/Driver rows, never from a request param.
@UseGuards(JwtAuthGuard)
@Controller("organizations/me/driver-portal")
export class DriverPortalController {
  constructor(private readonly driverPortal: DriverPortalService) {}

  @Get("me")
  getMe(@CurrentUser() user: JwtPayload) {
    return this.driverPortal.getMe(user.organizationId, user.sub);
  }

  @Post("tracking")
  submitTracking(@CurrentUser() user: JwtPayload, @Body() dto: SubmitTrackingDto) {
    return this.driverPortal.submitTracking(user.organizationId, user.sub, dto);
  }
}
