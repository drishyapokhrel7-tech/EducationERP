import { Module } from "@nestjs/common";
import { DisciplineService } from "./discipline.service";
import { DisciplineController } from "./discipline.controller";

@Module({
  providers: [DisciplineService],
  controllers: [DisciplineController],
})
export class DisciplineModule {}
