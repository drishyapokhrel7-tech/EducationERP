import { Module } from "@nestjs/common";
import { StudentPortalService } from "./student-portal.service";
import { StudentPortalController } from "./student-portal.controller";
import { DashboardsModule } from "../dashboards/dashboards.module";
import { FinanceModule } from "../finance/finance.module";
import { AssignmentsModule } from "../assignments/assignments.module";
import { KnowledgeChecksModule } from "../knowledge-checks/knowledge-checks.module";

@Module({
  imports: [DashboardsModule, FinanceModule, AssignmentsModule, KnowledgeChecksModule],
  providers: [StudentPortalService],
  controllers: [StudentPortalController],
})
export class StudentPortalModule {}
