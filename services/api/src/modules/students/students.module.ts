import { Module } from "@nestjs/common";
import { StudentsService } from "./students.service";
import { StudentsController } from "./students.controller";

@Module({
  providers: [StudentsService],
  controllers: [StudentsController],
  // AdmissionsModule reuses StudentsService.nextStudentCode so
  // enrollment goes through the same code-generation rule as the
  // direct Students-page create path.
  exports: [StudentsService],
})
export class StudentsModule {}
