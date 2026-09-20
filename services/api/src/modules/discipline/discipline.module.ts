import { Module } from "@nestjs/common";
import { DisciplineService } from "./discipline.service";
import { DisciplineController } from "./discipline.controller";

@Module({
  providers: [DisciplineService],
  controllers: [DisciplineController],
  // DataSyncModule reuses DisciplineService's Excel round-trip methods
  // for the combined multi-entity template/export/import.
  exports: [DisciplineService],
})
export class DisciplineModule {}
