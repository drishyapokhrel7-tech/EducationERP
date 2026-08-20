import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { DashboardsService } from "../dashboards/dashboards.service";

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
  ) {}

  async getDashboard(organizationId: string, userId: string) {
    const student = await this.prisma.withTenant(organizationId, (tx) =>
      tx.student.findUnique({ where: { userId } }),
    );
    if (!student) throw new NotFoundException("No student record is linked to this account");

    return this.dashboards.studentDashboard(organizationId, student.id);
  }
}
