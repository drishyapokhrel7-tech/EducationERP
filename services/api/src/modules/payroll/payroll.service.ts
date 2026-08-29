import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PayrollItemType, PayrollStatus, LeaveRequestStatus, EmployeeStatus, Prisma, PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateSalaryStructureDto, SalaryStructureItemDto } from "./dto/create-salary-structure.dto";
import { AddSalaryStructureItemDto } from "./dto/add-salary-structure-item.dto";
import { GeneratePayrollDto } from "./dto/generate-payroll.dto";
import { AddPayrollItemDto } from "./dto/add-payroll-item.dto";
import { MarkPayrollPaidDto } from "./dto/mark-payroll-paid.dto";

function toNumber(value: Prisma.Decimal | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

function assertXor(item: SalaryStructureItemDto) {
  if (!item.amount === !item.percentOfBasic) {
    throw new BadRequestException(`Provide exactly one of amount or percentOfBasic for item "${item.name}"`);
  }
}

function daysInMonth(year: number, month: number): number {
  // Date.UTC's month param is 0-indexed, so passing the 1-indexed
  // target month with day 0 lands on the last day of that month.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Salary structures ─────────────────────────────────────────────

  async createSalaryStructure(organizationId: string, dto: CreateSalaryStructureDto) {
    dto.items.forEach(assertXor);
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.salaryStructure.create({
        data: {
          organizationId,
          name: dto.name,
          basicSalary: dto.basicSalary,
          items: {
            create: dto.items.map((item) => ({
              organizationId,
              type: item.type,
              name: item.name,
              amount: item.amount,
              percentOfBasic: item.percentOfBasic,
            })),
          },
        },
        include: { items: true },
      }),
    );
  }

  listSalaryStructures(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.salaryStructure.findMany({ where: { organizationId }, include: { items: true }, orderBy: { name: "asc" } }),
    );
  }

  async addSalaryStructureItem(organizationId: string, structureId: string, dto: AddSalaryStructureItemDto) {
    assertXor(dto);
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadSalaryStructure(tx, organizationId, structureId);
      return tx.salaryStructureItem.create({
        data: {
          organizationId,
          salaryStructureId: structureId,
          type: dto.type,
          name: dto.name,
          amount: dto.amount,
          percentOfBasic: dto.percentOfBasic,
        },
      });
    });
  }

  async removeSalaryStructureItem(organizationId: string, structureId: string, itemId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadSalaryStructure(tx, organizationId, structureId);
      const item = await tx.salaryStructureItem.findUnique({ where: { id: itemId } });
      if (!item || item.salaryStructureId !== structureId) throw new NotFoundException("Salary structure item not found");
      await tx.salaryStructureItem.delete({ where: { id: itemId } });
      return { id: itemId };
    });
  }

  private async loadSalaryStructure(tx: PrismaClient, organizationId: string, id: string) {
    const structure = await tx.salaryStructure.findUnique({ where: { id } });
    if (!structure || structure.organizationId !== organizationId) throw new NotFoundException("Salary structure not found");
    return structure;
  }

  // ── Employee assignment ─────────────────────────────────────────────

  async assignSalaryStructure(organizationId: string, employeeId: string, structureId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const employee = await tx.employee.findUnique({ where: { id: employeeId } });
      if (!employee || employee.organizationId !== organizationId) throw new NotFoundException("Employee not found");
      await this.loadSalaryStructure(tx, organizationId, structureId);
      return tx.employee.update({ where: { id: employeeId }, data: { salaryStructureId: structureId } });
    });
  }

  async unassignSalaryStructure(organizationId: string, employeeId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const employee = await tx.employee.findUnique({ where: { id: employeeId } });
      if (!employee || employee.organizationId !== organizationId) throw new NotFoundException("Employee not found");
      return tx.employee.update({ where: { id: employeeId }, data: { salaryStructureId: null } });
    });
  }

  // ── Payroll generation ───────────────────────────────────────────────

  // Read-only mirror of generatePayroll's own eligibility check (same
  // employee/period query, no writes) — lets the frontend show the
  // real blast radius ("N employees, NPR gross total") before a
  // payroll run for the whole staff actually fires. The total here is
  // the structure-based gross (basic + earning items - deduction
  // items) and deliberately excludes the unpaid-leave deduction the
  // real generation also applies per employee — that adjustment needs
  // its own per-employee leave-request query, too costly to replicate
  // here just for a preview number, and it only ever reduces the real
  // total, never increases it, so this stays an honest upper bound.
  async previewPayrollGeneration(organizationId: string, dto: GeneratePayrollDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const employees = await tx.employee.findMany({
        where: { organizationId, status: EmployeeStatus.ACTIVE, salaryStructureId: { not: null } },
        include: { salaryStructure: { include: { items: true } } },
      });

      let eligibleCount = 0;
      let alreadyGeneratedCount = 0;
      let grossTotal = 0;
      for (const employee of employees) {
        const existing = await tx.payroll.findUnique({
          where: {
            employeeId_periodMonth_periodYear: {
              employeeId: employee.id,
              periodMonth: dto.periodMonth,
              periodYear: dto.periodYear,
            },
          },
        });
        if (existing) {
          alreadyGeneratedCount++;
          continue;
        }
        eligibleCount++;
        const structure = employee.salaryStructure!;
        const basicSalary = toNumber(structure.basicSalary);
        let net = basicSalary;
        for (const item of structure.items) {
          const amount = item.amount != null ? toNumber(item.amount) : (basicSalary * toNumber(item.percentOfBasic!)) / 100;
          net += item.type === PayrollItemType.DEDUCTION ? -amount : amount;
        }
        grossTotal += net;
      }

      return { eligibleCount, alreadyGeneratedCount, grossTotal };
    });
  }

  async generatePayroll(organizationId: string, dto: GeneratePayrollDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const employees = await tx.employee.findMany({
        where: { organizationId, status: EmployeeStatus.ACTIVE, salaryStructureId: { not: null } },
        include: { salaryStructure: { include: { items: true } } },
      });

      const generated: string[] = [];
      const skipped: { employeeId: string; reason: string }[] = [];
      for (const employee of employees) {
        const existing = await tx.payroll.findUnique({
          where: {
            employeeId_periodMonth_periodYear: {
              employeeId: employee.id,
              periodMonth: dto.periodMonth,
              periodYear: dto.periodYear,
            },
          },
        });
        if (existing) {
          skipped.push({ employeeId: employee.id, reason: "Already generated for this period" });
          continue;
        }

        const structure = employee.salaryStructure!;
        const basicSalary = toNumber(structure.basicSalary);
        // Basic salary itself is always the first earning item — the
        // structure's own items are allowances/deductions layered on top
        // of it, not a replacement for it.
        const items = [
          { organizationId, type: PayrollItemType.EARNING, name: "Basic Salary", amount: basicSalary },
          ...structure.items.map((item) => ({
            organizationId,
            type: item.type,
            name: item.name,
            amount: item.amount != null ? toNumber(item.amount) : (basicSalary * toNumber(item.percentOfBasic!)) / 100,
          })),
        ];

        const unpaidDays = await this.unpaidLeaveDaysFor(tx, organizationId, employee.id, dto.periodMonth, dto.periodYear);
        if (unpaidDays > 0) {
          const dailyRate = basicSalary / daysInMonth(dto.periodYear, dto.periodMonth);
          items.push({
            organizationId,
            type: PayrollItemType.DEDUCTION,
            name: `Unpaid Leave (${unpaidDays} day${unpaidDays === 1 ? "" : "s"})`,
            amount: dailyRate * unpaidDays,
          });
        }

        await tx.payroll.create({
          data: {
            organizationId,
            employeeId: employee.id,
            periodMonth: dto.periodMonth,
            periodYear: dto.periodYear,
            items: { create: items },
          },
        });
        generated.push(employee.id);
      }
      return { generated, skipped };
    });
  }

  private async unpaidLeaveDaysFor(
    tx: PrismaClient,
    organizationId: string,
    employeeId: string,
    periodMonth: number,
    periodYear: number,
  ): Promise<number> {
    const periodStart = new Date(Date.UTC(periodYear, periodMonth - 1, 1));
    const periodEnd = new Date(Date.UTC(periodYear, periodMonth, 1));
    const requests = await tx.leaveRequest.findMany({
      where: {
        organizationId,
        employeeId,
        status: LeaveRequestStatus.APPROVED,
        startDate: { gte: periodStart, lt: periodEnd },
        leaveType: { isPaid: false },
      },
    });
    return requests.reduce((sum, r) => sum + r.days, 0);
  }

  // ── Payroll lifecycle ────────────────────────────────────────────────

  listPayroll(
    organizationId: string,
    filters: { employeeId?: string; periodMonth?: number; periodYear?: number; status?: PayrollStatus },
  ) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.payroll.findMany({
        where: {
          organizationId,
          employeeId: filters.employeeId,
          periodMonth: filters.periodMonth,
          periodYear: filters.periodYear,
          status: filters.status,
        },
        include: { employee: true, items: true },
        orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }, { createdAt: "desc" }],
      }),
    );
  }

  getPayroll(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const payroll = await tx.payroll.findUnique({
        where: { id },
        include: { employee: true, items: true, finalizer: true },
      });
      if (!payroll || payroll.organizationId !== organizationId) throw new NotFoundException("Payroll not found");
      return payroll;
    });
  }

  async addPayrollItem(organizationId: string, id: string, dto: AddPayrollItemDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadEditablePayroll(tx, organizationId, id);
      return tx.payrollItem.create({
        data: { organizationId, payrollId: id, type: dto.type, name: dto.name, amount: dto.amount },
      });
    });
  }

  async removePayrollItem(organizationId: string, id: string, itemId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadEditablePayroll(tx, organizationId, id);
      const item = await tx.payrollItem.findUnique({ where: { id: itemId } });
      if (!item || item.payrollId !== id) throw new NotFoundException("Payroll item not found");
      await tx.payrollItem.delete({ where: { id: itemId } });
      return { id: itemId };
    });
  }

  async finalizePayroll(organizationId: string, userId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const payroll = await this.loadPayroll(tx, organizationId, id);
      if (payroll.status !== PayrollStatus.DRAFT) {
        throw new ConflictException(`This payroll is already ${payroll.status.toLowerCase()}`);
      }
      const items = await tx.payrollItem.findMany({ where: { payrollId: id } });
      const grossPay = items.filter((i) => i.type === PayrollItemType.EARNING).reduce((sum, i) => sum + toNumber(i.amount), 0);
      const totalDeductions = items
        .filter((i) => i.type === PayrollItemType.DEDUCTION)
        .reduce((sum, i) => sum + toNumber(i.amount), 0);

      return tx.payroll.update({
        where: { id },
        data: {
          status: PayrollStatus.FINALIZED,
          grossPay,
          totalDeductions,
          netPay: grossPay - totalDeductions,
          finalizedAt: new Date(),
          finalizedBy: userId,
        },
        include: { items: true, employee: true },
      });
    });
  }

  async markPayrollPaid(organizationId: string, id: string, dto: MarkPayrollPaidDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const payroll = await this.loadPayroll(tx, organizationId, id);
      if (payroll.status !== PayrollStatus.FINALIZED) {
        throw new ConflictException(`This payroll must be finalized before it can be marked paid (currently ${payroll.status.toLowerCase()})`);
      }
      return tx.payroll.update({
        where: { id },
        data: { status: PayrollStatus.PAID, paymentMethod: dto.paymentMethod, paidAt: new Date() },
        include: { items: true, employee: true },
      });
    });
  }

  async cancelPayroll(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const payroll = await this.loadPayroll(tx, organizationId, id);
      if (payroll.status === PayrollStatus.PAID || payroll.status === PayrollStatus.CANCELLED) {
        throw new ConflictException(`This payroll is already ${payroll.status.toLowerCase()}`);
      }
      return tx.payroll.update({ where: { id }, data: { status: PayrollStatus.CANCELLED } });
    });
  }

  private async loadPayroll(tx: PrismaClient, organizationId: string, id: string) {
    const payroll = await tx.payroll.findUnique({ where: { id } });
    if (!payroll || payroll.organizationId !== organizationId) throw new NotFoundException("Payroll not found");
    return payroll;
  }

  private async loadEditablePayroll(tx: PrismaClient, organizationId: string, id: string) {
    const payroll = await this.loadPayroll(tx, organizationId, id);
    if (payroll.status !== PayrollStatus.DRAFT) {
      throw new ConflictException(`Payroll items can only be changed while a payroll is still draft (currently ${payroll.status.toLowerCase()})`);
    }
    return payroll;
  }
}
