import { Module } from "@nestjs/common";
import { TeacherPortalService } from "./teacher-portal.service";
import { TeacherPortalController } from "./teacher-portal.controller";
import { DashboardsModule } from "../dashboards/dashboards.module";

@Module({
  imports: [DashboardsModule],
  providers: [TeacherPortalService],
  controllers: [TeacherPortalController],
})
export class TeacherPortalModule {}
