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
import { ClassSessionsModule } from "./modules/class-sessions/class-sessions.module";
import { AssignmentsModule } from "./modules/assignments/assignments.module";
import { KnowledgeChecksModule } from "./modules/knowledge-checks/knowledge-checks.module";
import { DashboardsModule } from "./modules/dashboards/dashboards.module";
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
    ClassSessionsModule,
    AssignmentsModule,
    KnowledgeChecksModule,
    DashboardsModule,
    QueueModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
