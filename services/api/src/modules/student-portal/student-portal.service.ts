import { Injectable, NotFoundException } from "@nestjs/common";
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

  private async getOwnStudent(organizationId: string, userId: string) {
    const student = await this.prisma.withTenant(organizationId, (tx) =>
      tx.student.findUnique({ where: { userId } }),
    );
    if (!student) throw new NotFoundException("No student record is linked to this account");
    return student;
  }
}
