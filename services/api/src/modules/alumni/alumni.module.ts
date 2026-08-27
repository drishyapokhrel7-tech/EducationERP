import { Module } from "@nestjs/common";
import { AlumniService } from "./alumni.service";
import { AlumniController } from "./alumni.controller";

@Module({
  providers: [AlumniService],
  controllers: [AlumniController],
  // Reused by StudentPortalModule for self-service alumni profile
  // management — an alumnus keeps using their existing student
  // portal login rather than a parallel alumni auth system.
  exports: [AlumniService],
})
export class AlumniModule {}
