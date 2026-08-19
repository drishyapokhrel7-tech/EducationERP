import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { OrgStructureModule } from "./modules/org-structure/org-structure.module";
import { StaffModule } from "./modules/staff/staff.module";
import { AcademicsModule } from "./modules/academics/academics.module";
import { StudentsModule } from "./modules/students/students.module";
import { AdmissionsModule } from "./modules/admissions/admissions.module";
import { TimetableModule } from "./modules/timetable/timetable.module";
import { AttendanceModule } from "./modules/attendance/attendance.module";
import { SyllabusModule } from "./modules/syllabus/syllabus.module";
import { QueueModule } from "./queue/queue.module";
import { HealthController } from "./common/health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    OrgStructureModule,
    StaffModule,
    AcademicsModule,
    StudentsModule,
    AdmissionsModule,
    TimetableModule,
    AttendanceModule,
    SyllabusModule,
    QueueModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
