import { Module } from "@nestjs/common";
import { TeacherPortalService } from "./teacher-portal.service";
import { TeacherPortalController } from "./teacher-portal.controller";
import { DashboardsModule } from "../dashboards/dashboards.module";
import { AssignmentsModule } from "../assignments/assignments.module";
import { KnowledgeChecksModule } from "../knowledge-checks/knowledge-checks.module";
import { DiscussionsModule } from "../discussions/discussions.module";

@Module({
  imports: [DashboardsModule, AssignmentsModule, KnowledgeChecksModule, DiscussionsModule],
  providers: [TeacherPortalService],
  controllers: [TeacherPortalController],
})
export class TeacherPortalModule {}
