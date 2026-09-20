import { Module } from "@nestjs/common";
import { DataSyncService } from "./data-sync.service";
import { DataSyncController } from "./data-sync.controller";
import { StudentsModule } from "../students/students.module";
import { StaffModule } from "../staff/staff.module";
import { DisciplineModule } from "../discipline/discipline.module";
import { HealthModule } from "../health/health.module";

@Module({
  imports: [StudentsModule, StaffModule, DisciplineModule, HealthModule],
  providers: [DataSyncService],
  controllers: [DataSyncController],
})
export class DataSyncModule {}
