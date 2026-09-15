import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { DashboardsService } from "../dashboards/dashboards.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AskGuardianQuestionDto } from "./dto/ask-guardian-question.dto";

// Same duplicated-not-shared isoDayOfWeek idiom as class-sessions.service.ts
// and teacher-portal.service.ts's own copies — see either for why it isn't
// a shared helper (Prisma doesn't support nested $transaction calls).
function isoDayOfWeek(date: Date): number {
  return ((date.getUTCDay() + 6) % 7) + 1;
}

/**
 * Self-service, not admin-facing — guardianId is derived exclusively
 * from the authenticated user's linked Guardian row, never from a
 * request param. Every method that touches a specific child additionally
 * checks assertOwnChild first, so a guardian can only ever reach their
 * own linked students by construction. Same JwtAuthGuard-only,
 * PermissionsGuard-free shape as student-portal/teacher-portal.
 */
@Injectable()
export class GuardianPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboards: DashboardsService,
    private readonly notifications: NotificationsService,
  ) {}

  async getMe(organizationId: string, userId: string) {
    return this.getOwnGuardian(organizationId, userId);
  }

  // Reuses DashboardsService.parentDashboard wholesale — it already does
  // guardianId -> StudentGuardian[] -> buildStudentDashboard per child,
  // exactly the "who are my children, what does each look like" shape
  // needed here. This wrapper only derives guardianId from the JWT
  // instead of trusting a URL param.
  async listMyChildren(organizationId: string, userId: string) {
    const guardian = await this.getOwnGuardian(organizationId, userId);
    return this.dashboards.parentDashboard(organizationId, guardian.id);
  }

  // Date-wise schedule for one child — like ClassSessionsService's/
  // TeacherPortalService's myClassesToday, but scoped by the CHILD's
  // active enrollment (program+section+semester) instead of "today"/
  // employeeId, and taking an explicit date so a guardian can browse
  // other days, not just today.
  async getChildScheduleForDate(organizationId: string, userId: string, studentId: string, dateStr: string) {
    const guardian = await this.getOwnGuardian(organizationId, userId);
    const date = new Date(dateStr);
    const dayOfWeek = isoDayOfWeek(date);

    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.assertOwnChild(tx, organizationId, guardian.id, studentId);

      const enrollment = await tx.studentEnrollment.findFirst({
        where: { organizationId, studentId, status: "ACTIVE" },
      });
      if (!enrollment) return [];

      return tx.classSchedule.findMany({
        where: {
          organizationId,
          dayOfWeek,
          teachingAssignment: {
            programId: enrollment.programId,
            sectionId: enrollment.sectionId,
            semesterId: enrollment.semesterId,
          },
        },
        include: {
          period: true,
          room: true,
          section: true,
          teachingAssignment: { include: { subject: true, employee: true, program: true } },
        },
        orderBy: { period: { sequence: "asc" } },
      });
    });
  }

  // Same "active enrollment -> matching TeachingAssignments -> published
  // KnowledgeChecks" idiom as StudentPortalService.listQuizzes, joined
  // with the child's own attempt if any. Read-only — no start/save/
  // submit surface here, guardians view, they don't take the quiz.
  async listChildQuizzes(organizationId: string, userId: string, studentId: string) {
    const guardian = await this.getOwnGuardian(organizationId, userId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.assertOwnChild(tx, organizationId, guardian.id, studentId);

      const enrollment = await tx.studentEnrollment.findFirst({
        where: { organizationId, studentId, status: "ACTIVE" },
      });
      if (!enrollment) return [];

      const teachingAssignments = await this.matchingTeachingAssignments(tx, organizationId, enrollment);
      const list = await tx.knowledgeCheck.findMany({
        where: {
          organizationId,
          status: "PUBLISHED",
          teachingAssignmentId: { in: teachingAssignments.map((t) => t.id) },
        },
        include: { teachingAssignment: { include: { subject: true, employee: true } }, questions: true },
        orderBy: { createdAt: "desc" },
      });

      const attempts = await tx.knowledgeCheckAttempt.findMany({
        where: { organizationId, studentId, knowledgeCheckId: { in: list.map((c) => c.id) } },
      });
      const byCheckId = new Map(attempts.map((a) => [a.knowledgeCheckId, a]));

      return list.map((c) => ({
        id: c.id,
        title: c.title,
        durationMinutes: c.durationMinutes,
        questionCount: c.questions.length,
        teachingAssignment: c.teachingAssignment,
        childAttempt: byCheckId.has(c.id)
          ? {
              startedAt: byCheckId.get(c.id)!.startedAt,
              submittedAt: byCheckId.get(c.id)!.submittedAt,
              score: byCheckId.get(c.id)!.score,
            }
          : null,
      }));
    });
  }

  // Populates the "which class is this about" picker on the
  // ask-a-question form.
  async listChildTeachingAssignments(organizationId: string, userId: string, studentId: string) {
    const guardian = await this.getOwnGuardian(organizationId, userId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.assertOwnChild(tx, organizationId, guardian.id, studentId);
      const enrollment = await tx.studentEnrollment.findFirst({
        where: { organizationId, studentId, status: "ACTIVE" },
      });
      if (!enrollment) return [];
      return this.matchingTeachingAssignments(tx, organizationId, enrollment);
    });
  }

  async askQuestion(organizationId: string, userId: string, studentId: string, dto: AskGuardianQuestionDto) {
    const guardian = await this.getOwnGuardian(organizationId, userId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.assertOwnChild(tx, organizationId, guardian.id, studentId);

      // Re-derive the child's current matching TeachingAssignments and
      // verify dto.teachingAssignmentId is one of them — not just that
      // it exists somewhere in the org, which would let a guardian
      // address a question to an unrelated teacher.
      const enrollment = await tx.studentEnrollment.findFirst({
        where: { organizationId, studentId, status: "ACTIVE" },
      });
      if (!enrollment) throw new NotFoundException("Child has no active enrollment");
      const matching = await this.matchingTeachingAssignments(tx, organizationId, enrollment);
      const ta = matching.find((t) => t.id === dto.teachingAssignmentId);
      if (!ta) throw new NotFoundException("That class isn't one of this child's current classes");

      const question = await tx.guardianQuestion.create({
        data: {
          organizationId,
          guardianId: guardian.id,
          studentId,
          teachingAssignmentId: dto.teachingAssignmentId,
          subject: dto.subject,
          body: dto.body,
        },
      });

      if (ta.employee.userId) {
        await this.notifications.notify(organizationId, ta.employee.userId, {
          type: "guardian_question_asked",
          title: `New question from a guardian about ${ta.subject.name}`,
          link: "/teacher",
        });
      }

      return question;
    });
  }

  async listMyQuestions(organizationId: string, userId: string, studentId?: string) {
    const guardian = await this.getOwnGuardian(organizationId, userId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      if (studentId) await this.assertOwnChild(tx, organizationId, guardian.id, studentId);
      return tx.guardianQuestion.findMany({
        where: { organizationId, guardianId: guardian.id, ...(studentId ? { studentId } : {}) },
        include: { teachingAssignment: { include: { subject: true, employee: true } } },
        orderBy: { createdAt: "desc" },
      });
    });
  }

  private async matchingTeachingAssignments(
    tx: PrismaClient,
    organizationId: string,
    enrollment: { programId: string; sectionId: string | null; semesterId: string },
  ) {
    return tx.teachingAssignment.findMany({
      where: {
        organizationId,
        programId: enrollment.programId,
        sectionId: enrollment.sectionId,
        semesterId: enrollment.semesterId,
      },
      include: { subject: true, employee: true },
    });
  }

  private async assertOwnChild(tx: PrismaClient, organizationId: string, guardianId: string, studentId: string) {
    const link = await tx.studentGuardian.findUnique({
      where: { studentId_guardianId: { studentId, guardianId } },
    });
    if (!link || link.organizationId !== organizationId) {
      throw new NotFoundException("Student not found");
    }
  }

  private async getOwnGuardian(organizationId: string, userId: string) {
    const guardian = await this.prisma.withTenant(organizationId, (tx) =>
      tx.guardian.findUnique({ where: { userId } }),
    );
    if (!guardian) throw new NotFoundException("No guardian record is linked to this account");
    return guardian;
  }
}
