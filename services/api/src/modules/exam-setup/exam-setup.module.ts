import { Module } from "@nestjs/common";
import { ExamSetupService } from "./exam-setup.service";
import { ExamSetupController } from "./exam-setup.controller";

@Module({
  providers: [ExamSetupService],
  controllers: [ExamSetupController],
})
export class ExamSetupModule {}
