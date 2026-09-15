import { Module } from "@nestjs/common";
import { GuardianPortalService } from "./guardian-portal.service";
import { GuardianPortalController } from "./guardian-portal.controller";
import { DashboardsModule } from "../dashboards/dashboards.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [DashboardsModule, NotificationsModule],
  providers: [GuardianPortalService],
  controllers: [GuardianPortalController],
})
export class GuardianPortalModule {}
