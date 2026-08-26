import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { DashboardsService } from "../dashboards/dashboards.service";
import { FinanceService } from "../finance/finance.service";

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
