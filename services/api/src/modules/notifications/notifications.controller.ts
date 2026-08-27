import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

// Deliberately JwtAuthGuard only, and deliberately role-agnostic — a
// notification is "for whoever is logged into this account," so this
// one controller serves every role (teacher, student, admin, driver)
// alike, unlike teacher-portal/student-portal's separate controllers.
@UseGuards(JwtAuthGuard)
@Controller("organizations/me/notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  listMine(@CurrentUser() user: JwtPayload) {
    return this.notifications.listMine(user.organizationId, user.sub);
  }

  @Post(":notificationId/read")
  markRead(@CurrentUser() user: JwtPayload, @Param("notificationId") notificationId: string) {
    return this.notifications.markRead(user.organizationId, user.sub, notificationId);
  }

  @Post("read-all")
  markAllRead(@CurrentUser() user: JwtPayload) {
    return this.notifications.markAllRead(user.organizationId, user.sub);
  }
}
