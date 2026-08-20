import { Module } from "@nestjs/common";
import { ExamGradingService } from "./exam-grading.service";
import { ExamGradingController } from "./exam-grading.controller";

@Module({
  providers: [ExamGradingService],
  controllers: [ExamGradingController],
})
export class ExamGradingModule {}
