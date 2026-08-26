import { Module } from "@nestjs/common";
import { AssignmentsService } from "./assignments.service";
import { AssignmentsController } from "./assignments.controller";

@Module({
  providers: [AssignmentsService],
  controllers: [AssignmentsController],
  // Reused by teacher-portal (create/update/grade, ownership-checked
  // first) and student-portal (submit, ownership-checked first) — same
  // "reuse the existing service, add a self-service guard in front"
  // precedent as DashboardsService/FinanceService.
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
