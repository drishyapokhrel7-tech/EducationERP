import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
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
import { ExamSetupModule } from "./modules/exam-setup/exam-setup.module";
import { ExamSchedulingModule } from "./modules/exam-scheduling/exam-scheduling.module";
import { ExamEvaluationModule } from "./modules/exam-evaluation/exam-evaluation.module";
import { ExamGradingModule } from "./modules/exam-grading/exam-grading.module";
import { StudentPortalModule } from "./modules/student-portal/student-portal.module";
import { ExamTakingModule } from "./modules/exam-taking/exam-taking.module";
import { BiometricPolicyModule } from "./modules/biometric-policy/biometric-policy.module";
import { AiGatewayModule } from "./modules/ai-gateway/ai-gateway.module";
import { CameraEventsModule } from "./modules/camera-events/camera-events.module";
import { DeviceGatewayModule } from "./modules/device-gateway/device-gateway.module";
import { FinanceModule } from "./modules/finance/finance.module";
import { BillingModule } from "./modules/billing/billing.module";
import { RbacModule } from "./modules/rbac/rbac.module";
import { LeaveModule } from "./modules/leave/leave.module";
import { PayrollModule } from "./modules/payroll/payroll.module";
import { TransportModule } from "./modules/transport/transport.module";
import { DriverPortalModule } from "./modules/driver-portal/driver-portal.module";
import { TeacherPortalModule } from "./modules/teacher-portal/teacher-portal.module";
import { StorageModule } from "./modules/storage/storage.module";
import { HostelModule } from "./modules/hostel/hostel.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { CommunicationModule } from "./modules/communication/communication.module";
import { DocumentsModule } from "./modules/documents/documents.module";
import { AlumniModule } from "./modules/alumni/alumni.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { SearchModule } from "./modules/search/search.module";
import { PlatformAuthModule } from "./modules/platform-auth/platform-auth.module";
import { PlatformOrganizationsModule } from "./modules/platform-organizations/platform-organizations.module";
import { HealthWatchdogModule } from "./modules/health-watchdog/health-watchdog.module";
import { LeadsModule } from "./modules/leads/leads.module";
import { QueueModule } from "./queue/queue.module";
import { HealthController } from "./common/health.controller";

// QueueModule (BullMQ/ioredis) only backs the /queue/health diagnostic
// endpoint today — no real domain feature depends on it yet (see
// queue.controller.ts). On serverless (Vercel), there's no REDIS_URL
// and no persistent process for a worker to run in anyway, so it's
// left out entirely rather than letting ioredis retry-loop against an
// unreachable localhost:6379 inside a request-scoped function.
const queueModuleImports = process.env.REDIS_URL ? [QueueModule] : [];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Global default: 300 requests/minute per IP — generous enough
    // that a real admin session's normal parallel-fetch pages (the
    // onboarding checklist alone fires ~17 at once) never come close,
    // but a real limit against scripted abuse. Auth-sensitive routes
    // (login, register, forgot-password, captcha) override this with
    // a much tighter limit via @Throttle, on top of the CAPTCHA those
    // same routes already require — two independent layers, not one
    // relied on alone. In-memory storage (the default) is best-effort
    // on serverless — it resets on a cold start and isn't shared
    // across concurrent instances — same disclosed limitation this
    // project's own QueueModule already has for BullMQ/Redis, which
    // is genuinely unavailable in that environment rather than a gap
    // to silently pretend isn't there.
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 300 }]),
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
    ExamSetupModule,
    ExamSchedulingModule,
    ExamEvaluationModule,
    ExamGradingModule,
    StudentPortalModule,
    ExamTakingModule,
    BiometricPolicyModule,
    AiGatewayModule,
    CameraEventsModule,
    FinanceModule,
    BillingModule,
    RbacModule,
    LeaveModule,
    PayrollModule,
    TransportModule,
    DriverPortalModule,
    TeacherPortalModule,
    StorageModule,
    HostelModule,
    InventoryModule,
    CommunicationModule,
    DocumentsModule,
    AlumniModule,
    AnalyticsModule,
    SearchModule,
    PlatformAuthModule,
    PlatformOrganizationsModule,
    HealthWatchdogModule,
    DeviceGatewayModule,
    LeadsModule,
    ...queueModuleImports,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
