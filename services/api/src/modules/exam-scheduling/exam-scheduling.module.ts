import { Module } from "@nestjs/common";
import { ExamSchedulingService } from "./exam-scheduling.service";
import { ExamSchedulingController } from "./exam-scheduling.controller";

@Module({
  providers: [ExamSchedulingService],
  controllers: [ExamSchedulingController],
})
export class ExamSchedulingModule {}
