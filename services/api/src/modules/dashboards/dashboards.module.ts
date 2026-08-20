import { Module } from "@nestjs/common";
import { DashboardsService } from "./dashboards.service";
import { DashboardsController } from "./dashboards.controller";

@Module({
  providers: [DashboardsService],
  controllers: [DashboardsController],
  // Reused by StudentPortalModule's self-service dashboard endpoint —
  // studentDashboard() is the same aggregation, just called with a
  // server-derived studentId instead of an admin-supplied one.
  exports: [DashboardsService],
})
export class DashboardsModule {}
