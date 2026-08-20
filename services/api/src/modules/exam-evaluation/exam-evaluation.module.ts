import { Module } from "@nestjs/common";
import { ExamEvaluationService } from "./exam-evaluation.service";
import { ExamEvaluationController } from "./exam-evaluation.controller";

@Module({
  providers: [ExamEvaluationService],
  controllers: [ExamEvaluationController],
})
export class ExamEvaluationModule {}
