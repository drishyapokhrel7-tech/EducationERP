import { Controller, Get, UseGuards } from "@nestjs/common";
import { StudentPortalService } from "./student-portal.service";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

// Deliberately JwtAuthGuard only — no PermissionsGuard/@RequirePermissions.
// The existing resource:action permission model answers "can this role
// act on any row of this resource," which doesn't fit "can this specific
// student see their own data and nothing else." Authorization here comes
// entirely from studentId being derived server-side from the caller's own
// linked Student row (see StudentPortalService) — there's no permission
// string that would make that check more or less correct.
@UseGuards(JwtAuthGuard)
@Controller("organizations/me/portal")
export class StudentPortalController {
  constructor(private readonly studentPortal: StudentPortalService) {}

  @Get("dashboard")
  getDashboard(@CurrentUser() user: JwtPayload) {
    return this.studentPortal.getDashboard(user.organizationId, user.sub);
  }
}
