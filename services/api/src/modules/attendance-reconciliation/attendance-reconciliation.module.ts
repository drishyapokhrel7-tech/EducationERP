import { Module } from "@nestjs/common";
import { AttendanceReconciliationService } from "./attendance-reconciliation.service";

@Module({
  providers: [AttendanceReconciliationService],
  exports: [AttendanceReconciliationService],
})
export class AttendanceReconciliationModule {}
