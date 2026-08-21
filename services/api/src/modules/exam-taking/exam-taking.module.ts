import { Module } from "@nestjs/common";
import { ExamTakingService } from "./exam-taking.service";
import { ExamTakingController } from "./exam-taking.controller";

@Module({
  providers: [ExamTakingService],
  controllers: [ExamTakingController],
})
export class ExamTakingModule {}
