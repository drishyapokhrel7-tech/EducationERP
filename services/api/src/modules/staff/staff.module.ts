import { Module } from "@nestjs/common";
import { StaffService } from "./staff.service";
import { StaffController } from "./staff.controller";

@Module({
  providers: [StaffService],
  controllers: [StaffController],
  // DataSyncModule reuses StaffService's Excel round-trip methods for
  // the combined multi-entity template/export/import.
  exports: [StaffService],
})
export class StaffModule {}
