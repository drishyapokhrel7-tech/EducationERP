import { Module } from "@nestjs/common";
import { HealthService } from "./health.service";
import { HealthController } from "./health.controller";

@Module({
  providers: [HealthService],
  controllers: [HealthController],
  // DataSyncModule reuses HealthService's Excel round-trip methods for
  // the combined multi-entity template/export/import.
  exports: [HealthService],
})
export class HealthModule {}
