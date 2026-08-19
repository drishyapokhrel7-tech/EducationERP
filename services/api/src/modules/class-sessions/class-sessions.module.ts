import { Module } from "@nestjs/common";
import { ClassSessionsService } from "./class-sessions.service";
import { ClassSessionsController } from "./class-sessions.controller";

@Module({
  providers: [ClassSessionsService],
  controllers: [ClassSessionsController],
})
export class ClassSessionsModule {}
