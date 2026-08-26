import { Module } from "@nestjs/common";
import { TeacherPortalService } from "./teacher-portal.service";
import { TeacherPortalController } from "./teacher-portal.controller";
import { DashboardsModule } from "../dashboards/dashboards.module";
import { AssignmentsModule } from "../assignments/assignments.module";

@Module({
  imports: [DashboardsModule, AssignmentsModule],
  providers: [TeacherPortalService],
  controllers: [TeacherPortalController],
})
export class TeacherPortalModule {}
