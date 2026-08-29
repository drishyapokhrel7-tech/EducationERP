import { Module } from "@nestjs/common";
import { AdmissionsService } from "./admissions.service";
import { AdmissionsController } from "./admissions.controller";
import { StudentsModule } from "../students/students.module";

@Module({
  imports: [StudentsModule],
  providers: [AdmissionsService],
  controllers: [AdmissionsController],
})
export class AdmissionsModule {}
