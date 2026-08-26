import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { DashboardsService } from "../dashboards/dashboards.service";
import { FinanceService } from "../finance/finance.service";
import { AssignmentsService } from "../assignments/assignments.service";
import { KnowledgeChecksService } from "../knowledge-checks/knowledge-checks.service";
import { SaveQuizAnswerDto } from "../knowledge-checks/dto/save-quiz-answer.dto";

/**
 * Self-service, not admin-facing — studentId is derived exclusively from
 * the authenticated user's linked Student row, never from a request
 * param. There is nothing here for a caller to tamper with: a student
 * user can only ever see their own data by construction. See the plan
 * (docs/PHASE_4_NOTES.md-adjacent slice 4e writeup) for why this is
 * gated differently from every other module's @RequirePermissions
 * pattern.
 */
@Injectable()
export class StudentPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboards: DashboardsService,
    private readonly finance: FinanceService,
    private readonly assignments: AssignmentsService,
    private readonly knowledgeChecks: KnowledgeChecksService,
  ) {}

  async getDashboard(organizationId: string, userId: string) {
    const student = await this.getOwnStudent(organizationId, userId);
    return this.dashboards.studentDashboard(organizationId, student.id);
  }

  // ── Finance self-service (slice 7a-2) ────────────────────────────────

  async getInvoices(organizationId: string, userId: string) {
    const student = await this.getOwnStudent(organizationId, userId);
    return this.finance.listInvoicesForStudent(organizationId, student.id);
  }

  async initiateEsewaPayment(organizationId: string, userId: string, invoiceId: string, amount: number) {
    const student = await this.getOwnStudent(organizationId, userId);
    return this.finance.initiateEsewaPayment(organizationId, invoiceId, amount, null, "portal", student.id);
  }

  async confirmEsewaPayment(organizationId: string, userId: string, encodedData: string) {
    const student = await this.getOwnStudent(organizationId, userId);
    return this.finance.confirmEsewaPayment(organizationId, encodedData, student.id);
  }

  // ── Courses & modules (LMS discovery slice 2) ───────────────────────
  // "Enrolled in a course" is derived structurally from the student's
  // own active enrollment (section+term), never trusted from a request
  // param — every TeachingAssignment for that section+term is "a
  // course" the student is in, matching how Assignment/KnowledgeCheck
  // already scope themselves to TeachingAssignment.

  async listCourses(organizationId: string, userId: string) {
    const student = await this.getOwnStudent(organizationId, userId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      const enrollment = await tx.studentEnrollment.findFirst({ where: { organizationId, studentId: student.id, status: "ACTIVE" } });
      if (!enrollment) return [];
      return tx.teachingAssignment.findMany({
        where: { organizationId, sectionId: enrollment.sectionId, termId: enrollment.termId },
        include: { subject: true, employee: true, section: true, term: true },
      });
    });
  }

  async listModules(organizationId: string, userId: string, teachingAssignmentId: string) {
    const student = await this.getOwnStudent(organizationId, userId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.assertEnrolledInCourse(tx, organizationId, student.id, teachingAssignmentId);

      const modules = await tx.courseModule.findMany({
        where: { organizationId, teachingAssignmentId, isPublished: true },
        include: { items: { where: { isPublished: true }, orderBy: { sequence: "asc" } } },
        orderBy: { sequence: "asc" },
      });
      const itemIds = modules.flatMap((m) => m.items.map((i) => i.id));
      const completions = await tx.courseModuleItemCompletion.findMany({
        where: { organizationId, studentId: student.id, moduleItemId: { in: itemIds } },
      });
      const completedIds = new Set(completions.map((c) => c.moduleItemId));

      return modules.map((m) => ({
        ...m,
        items: m.items.map((i) => ({ ...i, completed: completedIds.has(i.id) })),
      }));
    });
  }

  async completeModuleItem(organizationId: string, userId: string, itemId: string) {
    const student = await this.getOwnStudent(organizationId, userId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      const item = await tx.courseModuleItem.findUnique({
        where: { id: itemId },
        include: { module: true },
      });
      if (!item || !item.isPublished || !item.module.isPublished) {
        throw new NotFoundException("Module item not found");
      }
      await this.assertEnrolledInCourse(tx, organizationId, student.id, item.module.teachingAssignmentId);

      return tx.courseModuleItemCompletion.upsert({
        where: { moduleItemId_studentId: { moduleItemId: itemId, studentId: student.id } },
        update: {},
        create: { organizationId, moduleItemId: itemId, studentId: student.id },
      });
    });
  }

  // ── Assignments (LMS discovery slice 3) ─────────────────────────────
  // Never returns another student's submission/feedback — each read
  // fetches only the calling student's own AssignmentSubmission
  // (findUnique by the assignmentId+studentId compound key), unlike
  // the admin/teacher views which legitimately see everyone's.

  async listAssignments(organizationId: string, userId: string) {
    const student = await this.getOwnStudent(organizationId, userId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      const enrollment = await tx.studentEnrollment.findFirst({ where: { organizationId, studentId: student.id, status: "ACTIVE" } });
      if (!enrollment) return [];

      const teachingAssignments = await tx.teachingAssignment.findMany({
        where: { organizationId, sectionId: enrollment.sectionId, termId: enrollment.termId },
      });
      const list = await tx.assignment.findMany({
        where: { organizationId, isPublished: true, teachingAssignmentId: { in: teachingAssignments.map((t) => t.id) } },
        include: { teachingAssignment: { include: { subject: true, employee: true } } },
        orderBy: { dueDate: "asc" },
      });

      const submissions = await tx.assignmentSubmission.findMany({
        where: { organizationId, studentId: student.id, assignmentId: { in: list.map((a) => a.id) } },
      });
      const byAssignmentId = new Map(submissions.map((s) => [s.assignmentId, s]));

      return list.map((a) => ({ ...a, mySubmission: byAssignmentId.get(a.id) ?? null }));
    });
  }

  async getAssignment(organizationId: string, userId: string, assignmentId: string) {
    const student = await this.getOwnStudent(organizationId, userId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      const assignment = await this.loadPublishedAssignment(tx, organizationId, student.id, assignmentId);
      const mySubmission = await tx.assignmentSubmission.findUnique({
        where: { assignmentId_studentId: { assignmentId, studentId: student.id } },
      });
      return { ...assignment, mySubmission };
    });
  }

  async submitAssignment(organizationId: string, userId: string, assignmentId: string, content: string | undefined) {
    const student = await this.getOwnStudent(organizationId, userId);
    await this.prisma.withTenant(organizationId, (tx) => this.loadPublishedAssignment(tx, organizationId, student.id, assignmentId));
    return this.assignments.submit(organizationId, assignmentId, { studentId: student.id, content });
  }

  private async loadPublishedAssignment(tx: PrismaClient, organizationId: string, studentId: string, assignmentId: string) {
    const assignment = await tx.assignment.findUnique({
      where: { id: assignmentId },
      include: { teachingAssignment: { include: { subject: true, employee: true } } },
    });
    if (!assignment || !assignment.isPublished) throw new NotFoundException("Assignment not found");
    await this.assertEnrolledInCourse(tx, organizationId, studentId, assignment.teachingAssignmentId);
    return assignment;
  }

  // ── Quizzes (LMS discovery slice 4) ─────────────────────────────────
  // Adapts exam-taking's shuffle/autosave/auto-score engine — see
  // KnowledgeChecksService's own comment on that section. Every call
  // here does its own enrollment check first (same "own ownership
  // check, then an independent top-level call into the reused service"
  // shape as assignments above), so a student can only ever start/save/
  // submit a quiz on a course they're actually enrolled in.

  async listQuizzes(organizationId: string, userId: string) {
    const student = await this.getOwnStudent(organizationId, userId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      const enrollment = await tx.studentEnrollment.findFirst({ where: { organizationId, studentId: student.id, status: "ACTIVE" } });
      if (!enrollment) return [];

      const teachingAssignments = await tx.teachingAssignment.findMany({
        where: { organizationId, sectionId: enrollment.sectionId, termId: enrollment.termId },
      });
      const list = await tx.knowledgeCheck.findMany({
        where: { organizationId, status: "PUBLISHED", teachingAssignmentId: { in: teachingAssignments.map((t) => t.id) } },
        include: { teachingAssignment: { include: { subject: true, employee: true } }, questions: true },
        orderBy: { createdAt: "desc" },
      });

      const attempts = await tx.knowledgeCheckAttempt.findMany({
        where: { organizationId, studentId: student.id, knowledgeCheckId: { in: list.map((c) => c.id) } },
      });
      const byCheckId = new Map(attempts.map((a) => [a.knowledgeCheckId, a]));

      return list.map((c) => ({
        id: c.id,
        title: c.title,
        durationMinutes: c.durationMinutes,
        questionCount: c.questions.length,
        teachingAssignment: c.teachingAssignment,
        myAttempt: byCheckId.has(c.id)
          ? {
              startedAt: byCheckId.get(c.id)!.startedAt,
              submittedAt: byCheckId.get(c.id)!.submittedAt,
              score: byCheckId.get(c.id)!.score,
            }
          : null,
      }));
    });
  }

  async getQuiz(organizationId: string, userId: string, checkId: string) {
    const student = await this.getOwnStudent(organizationId, userId);
    await this.assertEnrolledInQuizCourse(organizationId, student.id, checkId);
    return this.knowledgeChecks.getPublishedCheckSummary(organizationId, checkId, student.id);
  }

  async startQuiz(organizationId: string, userId: string, checkId: string) {
    const student = await this.getOwnStudent(organizationId, userId);
    await this.assertEnrolledInQuizCourse(organizationId, student.id, checkId);
    return this.knowledgeChecks.startAttempt(organizationId, checkId, student.id);
  }

  async saveQuizAnswer(organizationId: string, userId: string, checkId: string, questionId: string, dto: SaveQuizAnswerDto) {
    const student = await this.getOwnStudent(organizationId, userId);
    await this.assertEnrolledInQuizCourse(organizationId, student.id, checkId);
    return this.knowledgeChecks.saveAnswer(organizationId, checkId, student.id, questionId, dto);
  }

  async submitQuiz(organizationId: string, userId: string, checkId: string) {
    const student = await this.getOwnStudent(organizationId, userId);
    await this.assertEnrolledInQuizCourse(organizationId, student.id, checkId);
    return this.knowledgeChecks.submitAttempt(organizationId, checkId, student.id);
  }

  private async assertEnrolledInQuizCourse(organizationId: string, studentId: string, checkId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const check = await tx.knowledgeCheck.findUnique({ where: { id: checkId } });
      if (!check || check.status !== "PUBLISHED") throw new NotFoundException("Quiz not found");
      await this.assertEnrolledInCourse(tx, organizationId, studentId, check.teachingAssignmentId);
    });
  }

  private async assertEnrolledInCourse(
    tx: PrismaClient,
    organizationId: string,
    studentId: string,
    teachingAssignmentId: string,
  ) {
    const ta = await tx.teachingAssignment.findUnique({ where: { id: teachingAssignmentId } });
    if (!ta) throw new NotFoundException("Course not found");
    const enrollment = await tx.studentEnrollment.findFirst({
      where: { organizationId, studentId, sectionId: ta.sectionId, termId: ta.termId, status: "ACTIVE" },
    });
    if (!enrollment) throw new NotFoundException("Course not found");
    return ta;
  }

  private async getOwnStudent(organizationId: string, userId: string) {
    const student = await this.prisma.withTenant(organizationId, (tx) =>
      tx.student.findUnique({ where: { userId } }),
    );
    if (!student) throw new NotFoundException("No student record is linked to this account");
    return student;
  }
}
