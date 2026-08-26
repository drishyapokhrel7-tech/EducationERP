import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { LeaveRequestStatus, PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateLeaveTypeDto } from "./dto/create-leave-type.dto";
import { AllocateLeaveBalanceDto } from "./dto/allocate-leave-balance.dto";
import { CreateLeaveRequestDto } from "./dto/create-leave-request.dto";
import { ReviewLeaveRequestDto } from "./dto/review-leave-request.dto";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetweenInclusive(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}

@Injectable()
export class LeaveService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Leave types ───────────────────────────────────────────────────

  createLeaveType(organizationId: string, dto: CreateLeaveTypeDto) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.leaveType.create({
        data: {
          organizationId,
          name: dto.name,
          code: dto.code,
          defaultDaysPerYear: dto.defaultDaysPerYear,
          isPaid: dto.isPaid ?? true,
          carryForward: dto.carryForward ?? false,
        },
      }),
    );
  }

  listLeaveTypes(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.leaveType.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    );
  }

  // ── Balances ──────────────────────────────────────────────────────

  async allocateBalance(organizationId: string, dto: AllocateLeaveBalanceDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const employee = await tx.employee.findUnique({ where: { id: dto.employeeId } });
      if (!employee || employee.organizationId !== organizationId) throw new NotFoundException("Employee not found");
      const leaveType = await tx.leaveType.findUnique({ where: { id: dto.leaveTypeId } });
      if (!leaveType || leaveType.organizationId !== organizationId) throw new NotFoundException("Leave type not found");

      // Upsert, not reject-on-duplicate — re-running this is a legitimate
      // admin correction ("adjust this year's allocation"), not a
      // conflicting duplicate assignment.
      return tx.staffLeaveBalance.upsert({
        where: { employeeId_leaveTypeId_year: { employeeId: dto.employeeId, leaveTypeId: dto.leaveTypeId, year: dto.year } },
        update: { allocatedDays: dto.allocatedDays },
        create: {
          organizationId,
          employeeId: dto.employeeId,
          leaveTypeId: dto.leaveTypeId,
          year: dto.year,
          allocatedDays: dto.allocatedDays,
        },
        include: { leaveType: true },
      });
    });
  }

  async listEmployeeBalances(organizationId: string, employeeId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const employee = await tx.employee.findUnique({ where: { id: employeeId } });
      if (!employee || employee.organizationId !== organizationId) throw new NotFoundException("Employee not found");

      const balances = await tx.staffLeaveBalance.findMany({
        where: { organizationId, employeeId },
        include: { leaveType: true },
        orderBy: [{ year: "desc" }, { leaveType: { name: "asc" } }],
      });

      return Promise.all(
        balances.map(async (balance) => {
          const usedDays = await this.usedDaysFor(tx, organizationId, employeeId, balance.leaveTypeId, balance.year);
          return { ...balance, usedDays, remainingDays: balance.allocatedDays - usedDays };
        }),
      );
    });
  }

  private async usedDaysFor(
    tx: PrismaClient,
    organizationId: string,
    employeeId: string,
    leaveTypeId: string,
    year: number,
  ): Promise<number> {
    const approved = await tx.leaveRequest.findMany({
      where: {
        organizationId,
        employeeId,
        leaveTypeId,
        status: LeaveRequestStatus.APPROVED,
        startDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
      },
    });
    return approved.reduce((sum, r) => sum + r.days, 0);
  }

  // ── Requests ──────────────────────────────────────────────────────

  listLeaveRequests(organizationId: string, filters: { employeeId?: string; status?: LeaveRequestStatus }) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.leaveRequest.findMany({
        where: { organizationId, employeeId: filters.employeeId, status: filters.status },
        include: { employee: true, leaveType: true, reviewer: true },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  async createLeaveRequest(organizationId: string, dto: CreateLeaveRequestDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const employee = await tx.employee.findUnique({ where: { id: dto.employeeId } });
      if (!employee || employee.organizationId !== organizationId) throw new NotFoundException("Employee not found");
      const leaveType = await tx.leaveType.findUnique({ where: { id: dto.leaveTypeId } });
      if (!leaveType || leaveType.organizationId !== organizationId) throw new NotFoundException("Leave type not found");

      const startDate = new Date(dto.startDate);
      const endDate = new Date(dto.endDate);
      if (endDate < startDate) throw new BadRequestException("endDate must not be before startDate");
      const days = daysBetweenInclusive(startDate, endDate);

      await this.assertWithinBalance(tx, organizationId, dto.employeeId, dto.leaveTypeId, startDate.getUTCFullYear(), days);

      return tx.leaveRequest.create({
        data: {
          organizationId,
          employeeId: dto.employeeId,
          leaveTypeId: dto.leaveTypeId,
          startDate,
          endDate,
          days,
          reason: dto.reason,
        },
        include: { employee: true, leaveType: true },
      });
    });
  }

  private async assertWithinBalance(
    tx: PrismaClient,
    organizationId: string,
    employeeId: string,
    leaveTypeId: string,
    year: number,
    additionalDays: number,
  ) {
    const balance = await tx.staffLeaveBalance.findUnique({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
    });
    // No allocation for this employee+type+year means "untracked," not
    // "zero" — allowed freely (e.g. unpaid leave that isn't quota-managed).
    if (!balance) return;

    const usedDays = await this.usedDaysFor(tx, organizationId, employeeId, leaveTypeId, year);
    if (usedDays + additionalDays > balance.allocatedDays) {
      throw new BadRequestException(
        `This request exceeds the remaining leave balance (${balance.allocatedDays - usedDays} day(s) remaining)`,
      );
    }
  }

  async approveLeaveRequest(organizationId: string, userId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const request = await this.loadPendingRequest(tx, organizationId, id);

      // Re-check at approval time too — other requests may have been
      // approved in the meantime since this one was created.
      await this.assertWithinBalance(
        tx,
        organizationId,
        request.employeeId,
        request.leaveTypeId,
        request.startDate.getUTCFullYear(),
        request.days,
      );

      return tx.leaveRequest.update({
        where: { id },
        data: { status: LeaveRequestStatus.APPROVED, reviewedBy: userId, reviewedAt: new Date() },
        include: { employee: true, leaveType: true },
      });
    });
  }

  async rejectLeaveRequest(organizationId: string, userId: string, id: string, dto: ReviewLeaveRequestDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadPendingRequest(tx, organizationId, id);
      return tx.leaveRequest.update({
        where: { id },
        data: {
          status: LeaveRequestStatus.REJECTED,
          reviewedBy: userId,
          reviewedAt: new Date(),
          reviewComment: dto.reviewComment,
        },
        include: { employee: true, leaveType: true },
      });
    });
  }

  async cancelLeaveRequest(organizationId: string, userId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadPendingRequest(tx, organizationId, id);
      return tx.leaveRequest.update({
        where: { id },
        data: { status: LeaveRequestStatus.CANCELLED, reviewedBy: userId, reviewedAt: new Date() },
        include: { employee: true, leaveType: true },
      });
    });
  }

  private async loadPendingRequest(
    tx: PrismaClient,
    organizationId: string,
    id: string,
  ) {
    const request = await tx.leaveRequest.findUnique({ where: { id } });
    if (!request || request.organizationId !== organizationId) throw new NotFoundException("Leave request not found");
    if (request.status !== LeaveRequestStatus.PENDING) {
      throw new ConflictException(`This request is already ${request.status.toLowerCase()}`);
    }
    return request;
  }
}
