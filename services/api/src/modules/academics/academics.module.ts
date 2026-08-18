import { Module } from "@nestjs/common";
import { AcademicsService } from "./academics.service";
import { AcademicsController } from "./academics.controller";

@Module({
  providers: [AcademicsService],
  controllers: [AcademicsController],
})
export class AcademicsModule {}
