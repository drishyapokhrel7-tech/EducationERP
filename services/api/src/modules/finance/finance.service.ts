import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import {
  EsewaTransactionStatus,
  FinancialTransactionType,
  FineRuleType,
  InvoiceStatus,
  PaymentMethod,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EsewaGatewayService, EsewaRedirectPayload } from "./esewa-gateway.service";
import { CreateFeeCategoryDto } from "./dto/create-fee-category.dto";
import { UpdateFeeCategoryDto } from "./dto/update-fee-category.dto";
import { CreateFeeStructureDto } from "./dto/create-fee-structure.dto";
import { AssignFeeStructureDto, AssignFeeStructureBulkDto } from "./dto/assign-fee-structure.dto";
import { RecordPaymentDto } from "./dto/record-payment.dto";
import { ApplyDiscountDto } from "./dto/apply-discount.dto";
import { IssueRefundDto } from "./dto/issue-refund.dto";
import { CreateScholarshipDto } from "./dto/create-scholarship.dto";
import { UpdateScholarshipDto } from "./dto/update-scholarship.dto";
import { AssignScholarshipDto } from "./dto/assign-scholarship.dto";
import { CreateInstallmentPlanDto } from "./dto/create-installment-plan.dto";
import { CreateFineRuleDto } from "./dto/create-fine-rule.dto";
import { UpdateFineRuleDto } from "./dto/update-fine-rule.dto";
import { paginate } from "../../common/pagination";
import { assertNoDependents } from "../../common/assert-no-dependents";

function toNumber(value: Prisma.Decimal | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Same P2028 ("unable to start a transaction in the given time")
// retry precedent as PlatformOrganizationsService's own
// withP2028Retry — this project's well-documented ambient Neon
// connection-pool contention, surfaced whenever a sweep loops
// withTenant across every organization the way applyLateFees does.
async function withP2028Retry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isP2028 = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2028";
      if (!isP2028 || attempt >= 2) throw err;
      await sleep(200 * (attempt + 1));
    }
  }
}

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly esewaGateway: EsewaGatewayService,
  ) {}

  // ── Fee categories ──────────────────────────────────────────────────

  createFeeCategory(organizationId: string, dto: CreateFeeCategoryDto) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.feeCategory.create({ data: { organizationId, ...dto } }),
    );
  }

  listFeeCategories(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.feeCategory.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    );
  }

  async updateFeeCategory(organizationId: string, id: string, dto: UpdateFeeCategoryDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadFeeCategory(tx, organizationId, id);
      return tx.feeCategory.update({ where: { id }, data: dto });
    });
  }

  async deleteFeeCategory(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadFeeCategory(tx, organizationId, id);
      await assertNoDependents(
        [
          tx.feeStructureItem.count({ where: { feeCategoryId: id } }),
          tx.invoiceItem.count({ where: { feeCategoryId: id } }),
        ],
        "fee category",
      );
      await tx.feeCategory.delete({ where: { id } });
      return { deleted: true };
    });
  }

  private async loadFeeCategory(tx: PrismaClient, organizationId: string, id: string) {
    const category = await tx.feeCategory.findUnique({ where: { id } });
    if (!category || category.organizationId !== organizationId) throw new NotFoundException("Fee category not found");
    return category;
  }

  // ── Fee structures ──────────────────────────────────────────────────

  async createFeeStructure(organizationId: string, dto: CreateFeeStructureDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      // FK-vs-RLS-parent-guard: program/semester/categories must actually
      // be visible to this org, not just any row with a matching id.
      const program = await tx.program.findUnique({ where: { id: dto.programId } });
      if (!program) throw new NotFoundException("Program not found");
      const semester = await tx.semester.findUnique({ where: { id: dto.semesterId } });
      if (!semester) throw new NotFoundException("Semester not found");
      for (const item of dto.items) {
        const category = await tx.feeCategory.findUnique({ where: { id: item.feeCategoryId } });
        if (!category) throw new NotFoundException(`Fee category ${item.feeCategoryId} not found`);
      }

      return tx.feeStructure.create({
        data: {
          organizationId,
          programId: dto.programId,
          semesterId: dto.semesterId,
          name: dto.name,
          items: {
            create: dto.items.map((item) => ({
              organizationId,
              feeCategoryId: item.feeCategoryId,
              amount: item.amount,
            })),
          },
        },
        include: { items: { include: { feeCategory: true } } },
      });
    });
  }

  listFeeStructures(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.feeStructure.findMany({
        where: { organizationId },
        include: { program: true, semester: true, items: { include: { feeCategory: true } } },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  // ── Assignment + invoicing ──────────────────────────────────────────

  async assignFeeStructure(organizationId: string, feeStructureId: string, userId: string, dto: AssignFeeStructureDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const feeStructure = await this.loadFeeStructure(tx, feeStructureId);
      const enrollment = await tx.studentEnrollment.findUnique({ where: { id: dto.studentEnrollmentId } });
      if (!enrollment) throw new NotFoundException("Student enrollment not found");
      return this.createAssignmentAndInvoice(tx, organizationId, userId, feeStructure, enrollment, dto.dueDate);
    });
  }

  async assignFeeStructureBulk(
    organizationId: string,
    feeStructureId: string,
    userId: string,
    dto: AssignFeeStructureBulkDto,
  ) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const feeStructure = await this.loadFeeStructure(tx, feeStructureId);
      const enrollments = await tx.studentEnrollment.findMany({
        where: { organizationId, programId: feeStructure.programId, semesterId: feeStructure.semesterId, status: "ACTIVE" },
      });

      const assigned: string[] = [];
      const skipped: { studentEnrollmentId: string; reason: string }[] = [];
      for (const enrollment of enrollments) {
        const existing = await tx.studentFeeAssignment.findUnique({
          where: { studentEnrollmentId_feeStructureId: { studentEnrollmentId: enrollment.id, feeStructureId } },
        });
        if (existing) {
          skipped.push({ studentEnrollmentId: enrollment.id, reason: "Already assigned" });
          continue;
        }
        await this.createAssignmentAndInvoice(tx, organizationId, userId, feeStructure, enrollment, dto.dueDate);
        assigned.push(enrollment.id);
      }
      return { assigned, skipped };
    });
  }

  // Read-only mirror of assignFeeStructureBulk's own eligibility check
  // (same query, same existence check, no writes) — lets the frontend
  // show the real blast radius ("N students, NPR total") in a confirm
  // dialog before the bulk assignment actually fires.
  async previewFeeStructureBulk(organizationId: string, feeStructureId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const feeStructure = await this.loadFeeStructure(tx, feeStructureId);
      const enrollments = await tx.studentEnrollment.findMany({
        where: { organizationId, programId: feeStructure.programId, semesterId: feeStructure.semesterId, status: "ACTIVE" },
      });

      let eligibleCount = 0;
      let alreadyAssignedCount = 0;
      for (const enrollment of enrollments) {
        const existing = await tx.studentFeeAssignment.findUnique({
          where: { studentEnrollmentId_feeStructureId: { studentEnrollmentId: enrollment.id, feeStructureId } },
        });
        if (existing) alreadyAssignedCount++;
        else eligibleCount++;
      }

      const perStudentAmount = feeStructure.items.reduce((sum, item) => sum + toNumber(item.amount), 0);
      return { eligibleCount, alreadyAssignedCount, perStudentAmount, totalAmount: perStudentAmount * eligibleCount };
    });
  }

  // Same collision-retry shape as StudentsService.nextStudentCode /
  // createStudent — count-based, retried under a unique-index
  // violation from a concurrent create rather than trusting the count
  // alone.
  private async nextInvoiceNumber(tx: PrismaClient, organizationId: string): Promise<string> {
    const count = await tx.invoice.count({ where: { organizationId } });
    return `INV-${String(count + 1).padStart(6, "0")}`;
  }

  private async nextReceiptNumber(tx: PrismaClient, organizationId: string): Promise<string> {
    const count = await tx.payment.count({ where: { organizationId } });
    return `RCT-${String(count + 1).padStart(6, "0")}`;
  }

  private async createInvoiceWithNumber(
    tx: PrismaClient,
    organizationId: string,
    data: {
      studentId: string;
      studentEnrollmentId: string;
      totalAmount: number;
      dueDate: Date;
      items: { feeCategoryId: string; amount: Prisma.Decimal | number }[];
    },
  ) {
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const invoiceNumber = await this.nextInvoiceNumber(tx, organizationId);
      try {
        return await tx.invoice.create({
          data: {
            organizationId,
            invoiceNumber,
            studentId: data.studentId,
            studentEnrollmentId: data.studentEnrollmentId,
            totalAmount: data.totalAmount,
            dueDate: data.dueDate,
            items: {
              create: data.items.map((item) => ({
                organizationId,
                feeCategoryId: item.feeCategoryId,
                amount: item.amount,
              })),
            },
          },
        });
      } catch (err) {
        const isUniqueViolation = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
        if (!isUniqueViolation || attempt === maxAttempts) throw err;
      }
    }
    throw new Error("Could not generate a unique invoice number — please try again");
  }

  private async createPaymentWithNumber(
    tx: PrismaClient,
    organizationId: string,
    data: {
      invoiceId: string;
      amount: Prisma.Decimal | number;
      method: PaymentMethod;
      reference?: string | null;
      recordedBy?: string | null;
      paidAt: Date;
    },
  ) {
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const receiptNumber = await this.nextReceiptNumber(tx, organizationId);
      try {
        return await tx.payment.create({
          data: {
            organizationId,
            receiptNumber,
            invoiceId: data.invoiceId,
            amount: data.amount,
            method: data.method,
            reference: data.reference,
            recordedBy: data.recordedBy,
            paidAt: data.paidAt,
          },
        });
      } catch (err) {
        const isUniqueViolation = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
        if (!isUniqueViolation || attempt === maxAttempts) throw err;
      }
    }
    throw new Error("Could not generate a unique receipt number — please try again");
  }

  private async loadFeeStructure(tx: PrismaClient, feeStructureId: string) {
    const feeStructure = await tx.feeStructure.findUnique({
      where: { id: feeStructureId },
      include: { items: true },
    });
    if (!feeStructure) throw new NotFoundException("Fee structure not found");
    return feeStructure;
  }

  private async createAssignmentAndInvoice(
    tx: PrismaClient,
    organizationId: string,
    userId: string,
    feeStructure: Prisma.FeeStructureGetPayload<{ include: { items: true } }>,
    enrollment: { id: string; studentId: string; programId: string; semesterId: string },
    dueDate: string,
  ) {
    if (enrollment.programId !== feeStructure.programId || enrollment.semesterId !== feeStructure.semesterId) {
      throw new BadRequestException("This enrollment's program/semester does not match the fee structure's");
    }
    const existing = await tx.studentFeeAssignment.findUnique({
      where: {
        studentEnrollmentId_feeStructureId: { studentEnrollmentId: enrollment.id, feeStructureId: feeStructure.id },
      },
    });
    if (existing) throw new ConflictException("This fee structure is already assigned to this enrollment");

    const totalAmount = feeStructure.items.reduce((sum, item) => sum + toNumber(item.amount), 0);

    const invoice = await this.createInvoiceWithNumber(tx, organizationId, {
      studentId: enrollment.studentId,
      studentEnrollmentId: enrollment.id,
      totalAmount,
      dueDate: new Date(dueDate),
      items: feeStructure.items.map((item) => ({
        feeCategoryId: item.feeCategoryId,
        amount: item.amount,
      })),
    });
    await tx.studentFeeAssignment.create({
      data: {
        organizationId,
        studentEnrollmentId: enrollment.id,
        feeStructureId: feeStructure.id,
        invoiceId: invoice.id,
        assignedBy: userId,
      },
    });
    await tx.financialTransaction.create({
      data: { organizationId, type: FinancialTransactionType.INVOICE_CREATED, amount: totalAmount, invoiceId: invoice.id },
    });

    // Scholarships are auto-applied as Discount rows at the moment the
    // invoice is created — a snapshot, not a live reference, so a
    // scholarship change later never silently alters an already-issued
    // invoice.
    const activeScholarships = await tx.studentScholarship.findMany({
      where: { organizationId, studentId: enrollment.studentId, active: true },
      include: { scholarship: true },
    });
    for (const holding of activeScholarships) {
      const s = holding.scholarship;
      const reduction = s.percentage != null ? (totalAmount * s.percentage) / 100 : toNumber(s.amount ?? 0);
      if (reduction <= 0) continue;
      const discount = await tx.discount.create({
        data: {
          organizationId,
          invoiceId: invoice.id,
          scholarshipId: s.id,
          amount: reduction,
          reason: `Scholarship: ${s.name}`,
        },
      });
      await tx.financialTransaction.create({
        data: {
          organizationId,
          type: FinancialTransactionType.SCHOLARSHIP_APPLIED,
          amount: reduction,
          invoiceId: invoice.id,
          discountId: discount.id,
        },
      });
    }

    await this.recomputeInvoiceStatus(tx, organizationId, invoice.id);
    return tx.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
      include: { items: { include: { feeCategory: true } }, discounts: true, payments: true },
    });
  }

  // ── Invoices, payments, discounts, refunds ──────────────────────────

  // Paginated (Phase 8 performance-optimization slice). Also narrowed:
  // the list view only ever renders student.firstName/lastName, and
  // items/payments/discounts aren't rendered in the list at all — the
  // full graph is fetched separately by getInvoice() when a row is
  // opened, so dragging it into every list row was pure waste.
  listInvoices(organizationId: string, page: number, pageSize: number) {
    return this.prisma.withTenant(organizationId, (tx) => {
      const where = { organizationId };
      return paginate(
        () =>
          tx.invoice.findMany({
            where,
            include: { student: { select: { firstName: true, lastName: true } } },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
        () => tx.invoice.count({ where }),
        page,
        pageSize,
      );
    });
  }

  listInvoicesForStudent(organizationId: string, studentId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.invoice.findMany({
        where: { organizationId, studentId },
        include: {
          items: { include: { feeCategory: true } },
          payments: true,
          discounts: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  async getInvoice(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id },
        include: {
          // guardians ride along so the payment screen can show the
          // student's photo next to their guardians' photos — a
          // cashier taking a cash payment over the counter confirms
          // "right family" by face, not just by a typed-in name.
          student: {
            include: {
              guardians: {
                include: { guardian: true },
                orderBy: { isPrimaryContact: "desc" },
              },
            },
          },
          items: { include: { feeCategory: true } },
          payments: true,
          discounts: true,
        },
      });
      if (!invoice) throw new NotFoundException("Invoice not found");
      return invoice;
    });
  }

  // Letterhead metadata for the printable Invoice/Receipt PDFs — set
  // via Institutions > Branding, every field optional (the PDF falls
  // back to just the name).
  private orgLetterhead(organizationId: string) {
    return this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true, address: true, phone: true, email: true, website: true, logoUrl: true },
    });
  }

  private invoiceForDocument(tx: PrismaClient, id: string) {
    return tx.invoice.findUnique({
      where: { id },
      include: {
        student: { select: { firstName: true, lastName: true, studentCode: true } },
        items: { include: { feeCategory: { select: { name: true } } } },
        payments: true,
        discounts: true,
      },
    });
  }

  async getInvoiceDocument(organizationId: string, invoiceId: string) {
    const [org, invoice] = await Promise.all([
      this.orgLetterhead(organizationId),
      this.prisma.withTenant(organizationId, (tx) => this.invoiceForDocument(tx, invoiceId)),
    ]);
    if (!invoice) throw new NotFoundException("Invoice not found");
    return { org, invoice };
  }

  async getReceiptDocument(organizationId: string, paymentId: string) {
    const { org, payment } = await this.prisma.withTenant(organizationId, async (tx) => {
      const [orgRow, paymentRow] = await Promise.all([
        this.orgLetterhead(organizationId),
        tx.payment.findUnique({ where: { id: paymentId } }),
      ]);
      if (!paymentRow || paymentRow.organizationId !== organizationId) {
        throw new NotFoundException("Payment not found");
      }
      return { org: orgRow, payment: paymentRow };
    });
    const invoice = await this.prisma.withTenant(organizationId, (tx) =>
      this.invoiceForDocument(tx, payment.invoiceId),
    );
    if (!invoice) throw new NotFoundException("Invoice not found");
    return { org, invoice, payment };
  }

  async recordPayment(organizationId: string, invoiceId: string, userId: string, dto: RecordPaymentDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) throw new NotFoundException("Invoice not found");
      if (invoice.status === InvoiceStatus.CANCELLED) {
        throw new BadRequestException("Cannot record a payment against a cancelled invoice");
      }

      const payment = await this.createPaymentWithNumber(tx, organizationId, {
        invoiceId,
        amount: dto.amount,
        method: dto.method,
        reference: dto.reference,
        recordedBy: userId,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
      });
      await tx.financialTransaction.create({
        data: { organizationId, type: FinancialTransactionType.PAYMENT_RECORDED, amount: dto.amount, invoiceId, paymentId: payment.id },
      });
      await this.recomputeInvoiceStatus(tx, organizationId, invoiceId);
      return payment;
    });
  }

  // ── eSewa online payment (slice 7a-2) ────────────────────────────────

  async initiateEsewaPayment(
    organizationId: string,
    invoiceId: string,
    amount: number,
    initiatedBy: string | null,
    channel: "admin" | "portal",
    // Set only for the portal path — IDOR-by-construction, same as
    // every other self-service route: a student can only ever initiate
    // a payment against their own invoice.
    ownerStudentId?: string,
  ) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) throw new NotFoundException("Invoice not found");
      if (ownerStudentId && invoice.studentId !== ownerStudentId) {
        throw new NotFoundException("Invoice not found");
      }
      if (invoice.status === InvoiceStatus.CANCELLED) {
        throw new BadRequestException("Cannot pay a cancelled invoice");
      }

      const transactionUuid = randomUUID();
      await tx.esewaTransaction.create({
        data: {
          organizationId,
          invoiceId,
          transactionUuid,
          amount,
          initiatedBy: initiatedBy ?? undefined,
        },
      });

      // Both success and failure land on the same callback page for the
      // channel that initiated — the page itself distinguishes outcome
      // from whatever `data` param (if any) eSewa appends, rather than
      // this service guessing which URLs actually carry a payload.
      const webOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3020";
      const callbackPath = channel === "portal" ? "portal/esewa/callback" : "dashboard/finance/esewa/callback";
      const callbackUrl = `${webOrigin}/${callbackPath}`;

      return this.esewaGateway.buildPaymentForm({
        amount,
        transactionUuid,
        successUrl: callbackUrl,
        failureUrl: callbackUrl,
      });
    });
  }

  async confirmEsewaPayment(
    organizationId: string,
    encodedData: string,
    // Set only for the portal path — same IDOR-by-construction guard as initiateEsewaPayment.
    ownerStudentId?: string,
  ) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      let payload: EsewaRedirectPayload;
      try {
        payload = JSON.parse(Buffer.from(encodedData, "base64").toString("utf-8")) as EsewaRedirectPayload;
      } catch {
        throw new BadRequestException("Malformed payment confirmation payload");
      }
      if (!payload.transaction_uuid) {
        throw new BadRequestException("Malformed payment confirmation payload");
      }

      if (!this.esewaGateway.verifySignature(payload)) {
        // Not a hard rejection — see EsewaGatewayService's class doc.
        // The real gate below is a live checkStatus() call.
        this.logger.warn(`eSewa redirect signature did not verify for transaction ${payload.transaction_uuid}`);
      }

      const esewaTx = await tx.esewaTransaction.findUnique({
        where: { transactionUuid: payload.transaction_uuid },
        include: { invoice: { select: { studentId: true } } },
      });
      if (!esewaTx || esewaTx.organizationId !== organizationId) {
        throw new NotFoundException("Payment transaction not found");
      }
      if (ownerStudentId && esewaTx.invoice.studentId !== ownerStudentId) {
        throw new NotFoundException("Payment transaction not found");
      }

      if (esewaTx.status === EsewaTransactionStatus.COMPLETE) {
        // Idempotent replay — a reloaded callback page or a
        // double-submitted click must never credit twice.
        const payment = await tx.payment.findFirst({
          where: { organizationId, invoiceId: esewaTx.invoiceId, reference: esewaTx.transactionUuid },
        });
        return { status: "COMPLETE" as const, invoiceId: esewaTx.invoiceId, payment };
      }

      const result = await this.esewaGateway.checkStatus({
        transactionUuid: esewaTx.transactionUuid,
        totalAmount: toNumber(esewaTx.amount),
      });

      if (result.status !== "COMPLETE") {
        await tx.esewaTransaction.update({
          where: { id: esewaTx.id },
          data: {
            status: result.status === "CANCELED" ? EsewaTransactionStatus.CANCELED : EsewaTransactionStatus.FAILED,
            completedAt: new Date(),
          },
        });
        throw new BadRequestException(`Payment was not completed (eSewa status: ${result.status})`);
      }

      const payment = await this.createPaymentWithNumber(tx, organizationId, {
        invoiceId: esewaTx.invoiceId,
        amount: esewaTx.amount,
        method: PaymentMethod.ESEWA,
        reference: esewaTx.transactionUuid,
        recordedBy: null,
        paidAt: new Date(),
      });
      await tx.financialTransaction.create({
        data: {
          organizationId,
          type: FinancialTransactionType.PAYMENT_RECORDED,
          amount: esewaTx.amount,
          invoiceId: esewaTx.invoiceId,
          paymentId: payment.id,
        },
      });
      await tx.esewaTransaction.update({
        where: { id: esewaTx.id },
        data: { status: EsewaTransactionStatus.COMPLETE, esewaRefId: result.refId, completedAt: new Date() },
      });
      await this.recomputeInvoiceStatus(tx, organizationId, esewaTx.invoiceId);

      return { status: "COMPLETE" as const, invoiceId: esewaTx.invoiceId, payment };
    });
  }

  async applyDiscount(organizationId: string, invoiceId: string, userId: string, dto: ApplyDiscountDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { discounts: true } });
      if (!invoice) throw new NotFoundException("Invoice not found");
      const currentDiscounts = invoice.discounts.reduce((sum, d) => sum + toNumber(d.amount), 0);
      const outstanding = toNumber(invoice.totalAmount) - currentDiscounts;
      if (dto.amount > outstanding) {
        throw new BadRequestException("Discount amount exceeds the invoice's outstanding balance");
      }

      const discount = await tx.discount.create({
        data: { organizationId, invoiceId, amount: dto.amount, reason: dto.reason, appliedBy: userId },
      });
      await tx.financialTransaction.create({
        data: { organizationId, type: FinancialTransactionType.DISCOUNT_APPLIED, amount: dto.amount, invoiceId, discountId: discount.id },
      });
      await this.recomputeInvoiceStatus(tx, organizationId, invoiceId);
      return discount;
    });
  }

  async issueRefund(organizationId: string, paymentId: string, userId: string, dto: IssueRefundDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { refunds: true } });
      if (!payment) throw new NotFoundException("Payment not found");
      const alreadyRefunded = payment.refunds.reduce((sum, r) => sum + toNumber(r.amount), 0);
      if (dto.amount > toNumber(payment.amount) - alreadyRefunded) {
        throw new BadRequestException("Refund amount exceeds the amount still refundable on this payment");
      }

      const refund = await tx.refund.create({
        data: { organizationId, paymentId, amount: dto.amount, reason: dto.reason, processedBy: userId },
      });
      await tx.financialTransaction.create({
        data: {
          organizationId,
          type: FinancialTransactionType.REFUND_ISSUED,
          amount: dto.amount,
          invoiceId: payment.invoiceId,
          paymentId: payment.id,
          refundId: refund.id,
        },
      });
      await this.recomputeInvoiceStatus(tx, organizationId, payment.invoiceId);
      return refund;
    });
  }

  private async recomputeInvoiceStatus(tx: PrismaClient, organizationId: string, invoiceId: string) {
    const invoice = await tx.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { payments: { include: { refunds: true } }, discounts: true },
    });
    if (invoice.status === InvoiceStatus.CANCELLED) return;

    const netPayable = toNumber(invoice.totalAmount) - invoice.discounts.reduce((sum, d) => sum + toNumber(d.amount), 0);
    const netPaid = invoice.payments.reduce((sum, p) => {
      const refunded = p.refunds.reduce((rs, r) => rs + toNumber(r.amount), 0);
      return sum + toNumber(p.amount) - refunded;
    }, 0);

    const status =
      netPayable <= 0 || netPaid >= netPayable
        ? InvoiceStatus.PAID
        : netPaid > 0
          ? InvoiceStatus.PARTIALLY_PAID
          : InvoiceStatus.PENDING;

    if (status !== invoice.status) {
      await tx.invoice.update({ where: { id: invoiceId }, data: { status } });
    }
  }

  listFinancialTransactions(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.financialTransaction.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } }),
    );
  }

  // ── Scholarships ─────────────────────────────────────────────────────

  createScholarship(organizationId: string, dto: CreateScholarshipDto) {
    if (!dto.percentage === !dto.amount) {
      throw new BadRequestException("Provide exactly one of percentage or amount");
    }
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.scholarship.create({
        data: {
          organizationId,
          name: dto.name,
          description: dto.description,
          percentage: dto.percentage,
          amount: dto.amount,
        },
      }),
    );
  }

  listScholarships(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.scholarship.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    );
  }

  async updateScholarship(organizationId: string, id: string, dto: UpdateScholarshipDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadScholarship(tx, organizationId, id);
      return tx.scholarship.update({
        where: { id },
        data: { name: dto.name, description: dto.description, percentage: dto.percentage, amount: dto.amount },
      });
    });
  }

  async deleteScholarship(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadScholarship(tx, organizationId, id);
      await assertNoDependents(
        [
          tx.studentScholarship.count({ where: { scholarshipId: id } }),
          tx.discount.count({ where: { scholarshipId: id } }),
        ],
        "scholarship",
      );
      await tx.scholarship.delete({ where: { id } });
      return { deleted: true };
    });
  }

  private async loadScholarship(tx: PrismaClient, organizationId: string, id: string) {
    const scholarship = await tx.scholarship.findUnique({ where: { id } });
    if (!scholarship || scholarship.organizationId !== organizationId) throw new NotFoundException("Scholarship not found");
    return scholarship;
  }

  async assignScholarship(organizationId: string, studentId: string, dto: AssignScholarshipDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const student = await tx.student.findUnique({ where: { id: studentId } });
      if (!student) throw new NotFoundException("Student not found");
      const scholarship = await tx.scholarship.findUnique({ where: { id: dto.scholarshipId } });
      if (!scholarship) throw new NotFoundException("Scholarship not found");

      const existing = await tx.studentScholarship.findUnique({
        where: { studentId_scholarshipId: { studentId, scholarshipId: dto.scholarshipId } },
      });
      if (existing) throw new ConflictException("This scholarship is already assigned to this student");

      return tx.studentScholarship.create({
        data: { organizationId, studentId, scholarshipId: dto.scholarshipId },
        include: { scholarship: true },
      });
    });
  }

  // ── Installments ─────────────────────────────────────────────────────

  async createInstallmentPlan(organizationId: string, invoiceId: string, dto: CreateInstallmentPlanDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) throw new NotFoundException("Invoice not found");

      const existing = await tx.installment.count({ where: { invoiceId } });
      if (existing > 0) {
        throw new ConflictException("This invoice already has an installment plan");
      }

      const sum = dto.installments.reduce((s, i) => s + i.amount, 0);
      // Small float-rounding tolerance, same reasoning as every other
      // amount comparison in this service (discount/refund limits) —
      // never exact-equality on a Decimal-derived sum.
      if (Math.abs(sum - toNumber(invoice.totalAmount)) > 0.01) {
        throw new BadRequestException(
          `Installment amounts (${sum}) must add up to the invoice total (${toNumber(invoice.totalAmount)})`,
        );
      }

      await tx.installment.createMany({
        data: dto.installments.map((installment, index) => ({
          organizationId,
          invoiceId,
          sequence: index + 1,
          amount: installment.amount,
          dueDate: new Date(installment.dueDate),
        })),
      });
      // Computed against this same open transaction, not a fresh
      // listInstallments() call — that opens its own withTenant
      // transaction, which can't see the createMany above until this
      // one commits.
      return this.computeInstallments(tx, invoiceId);
    });
  }

  // No stored status — see Installment's own schema comment. Payments
  // are FIFO-allocated across installments in sequence order, same
  // "oldest obligation first" logic real institutions actually use,
  // regardless of which installment a cashier had in mind when they
  // took the payment.
  async listInstallments(organizationId: string, invoiceId: string) {
    return this.prisma.withTenant(organizationId, (tx) => this.computeInstallments(tx, invoiceId));
  }

  private async computeInstallments(tx: PrismaClient, invoiceId: string) {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: { include: { refunds: true } } },
    });
    if (!invoice) throw new NotFoundException("Invoice not found");

    const installments = await tx.installment.findMany({
      where: { invoiceId },
      orderBy: { sequence: "asc" },
    });

    let netPaid = invoice.payments.reduce((sum, p) => {
      const refunded = p.refunds.reduce((rs, r) => rs + toNumber(r.amount), 0);
      return sum + toNumber(p.amount) - refunded;
    }, 0);

    const now = new Date();
    return installments.map((installment) => {
      const amount = toNumber(installment.amount);
      const covered = Math.min(Math.max(netPaid, 0), amount);
      netPaid -= covered;

      const status =
        covered >= amount - 0.01
          ? ("PAID" as const)
          : covered > 0
            ? ("PARTIAL" as const)
            : installment.dueDate < now
              ? ("OVERDUE" as const)
              : ("PENDING" as const);

      return { ...installment, coveredAmount: Math.round(covered * 100) / 100, status };
    });
  }

  // ── Fine rules ───────────────────────────────────────────────────────

  createFineRule(organizationId: string, dto: CreateFineRuleDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const category = await tx.feeCategory.findUnique({ where: { id: dto.feeCategoryId } });
      if (!category || category.organizationId !== organizationId) {
        throw new NotFoundException("Fee category not found");
      }
      return tx.fineRule.create({
        data: { organizationId, feeCategoryId: dto.feeCategoryId, type: dto.type, amount: dto.amount },
        include: { feeCategory: true },
      });
    });
  }

  listFineRules(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.fineRule.findMany({ where: { organizationId }, include: { feeCategory: true }, orderBy: { createdAt: "desc" } }),
    );
  }

  async updateFineRule(organizationId: string, id: string, dto: UpdateFineRuleDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadFineRule(tx, organizationId, id);
      return tx.fineRule.update({ where: { id }, data: dto, include: { feeCategory: true } });
    });
  }

  async deleteFineRule(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadFineRule(tx, organizationId, id);
      await tx.fineRule.delete({ where: { id } });
      return { deleted: true };
    });
  }

  private async loadFineRule(tx: PrismaClient, organizationId: string, id: string) {
    const rule = await tx.fineRule.findUnique({ where: { id } });
    if (!rule || rule.organizationId !== organizationId) throw new NotFoundException("Fine rule not found");
    return rule;
  }

  // ── Late-fee application (internal/apply-late-fees cron) ────────────

  // Sweeps every organization, same batched-withTenant shape as
  // PlatformOrganizationsService.listOrganizations — this environment
  // has 140+ orgs, and a fully sequential loop over that many was
  // already confirmed live to hang an endpoint (that method's own
  // comment). FIXED/PERCENTAGE rules charge an overdue invoice once
  // ever (checked by the presence of an InvoiceItem for that rule's
  // feeCategoryId); PER_DAY rules charge once per elapsed calendar day
  // (checked by an InvoiceItem description carrying today's date), so
  // running this endpoint twice in the same day — or the cron retrying
  // — never double-charges either shape.
  async applyLateFees(): Promise<{ organizationsProcessed: number; invoicesCharged: number }> {
    const organizations = await this.prisma.organization.findMany({ select: { id: true } });
    const BATCH_SIZE = 8;
    let invoicesCharged = 0;

    for (let i = 0; i < organizations.length; i += BATCH_SIZE) {
      const batch = organizations.slice(i, i + BATCH_SIZE);
      const counts = await Promise.all(
        batch.map((org) => withP2028Retry(() => this.applyLateFeesForOrg(org.id))),
      );
      invoicesCharged += counts.reduce((sum, c) => sum + c, 0);
    }
    return { organizationsProcessed: organizations.length, invoicesCharged };
  }

  private async applyLateFeesForOrg(organizationId: string): Promise<number> {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const rules = await tx.fineRule.findMany({ where: { organizationId, active: true } });
      if (rules.length === 0) return 0;

      const overdueInvoices = await tx.invoice.findMany({
        where: {
          organizationId,
          status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID] },
          dueDate: { lt: new Date() },
        },
        include: { items: true, discounts: true, payments: { include: { refunds: true } } },
      });

      const todayLabel = new Date().toISOString().slice(0, 10);
      let charged = 0;

      for (const invoice of overdueInvoices) {
        const netPayable =
          toNumber(invoice.totalAmount) - invoice.discounts.reduce((sum, d) => sum + toNumber(d.amount), 0);
        const netPaid = invoice.payments.reduce((sum, p) => {
          const refunded = p.refunds.reduce((rs, r) => rs + toNumber(r.amount), 0);
          return sum + toNumber(p.amount) - refunded;
        }, 0);
        if (netPaid >= netPayable) continue;

        let invoiceCharged = false;
        for (const rule of rules) {
          const alreadyHasFixedOrPercentage =
            rule.type !== FineRuleType.PER_DAY && invoice.items.some((item) => item.feeCategoryId === rule.feeCategoryId);
          const alreadyChargedToday =
            rule.type === FineRuleType.PER_DAY &&
            invoice.items.some(
              (item) => item.feeCategoryId === rule.feeCategoryId && item.description?.endsWith(todayLabel),
            );
          if (alreadyHasFixedOrPercentage || alreadyChargedToday) continue;

          const fineAmount =
            rule.type === FineRuleType.PERCENTAGE ? (netPayable * toNumber(rule.amount)) / 100 : toNumber(rule.amount);
          if (fineAmount <= 0) continue;

          await tx.invoiceItem.create({
            data: {
              organizationId,
              invoiceId: invoice.id,
              feeCategoryId: rule.feeCategoryId,
              description: rule.type === FineRuleType.PER_DAY ? `Late fee — ${todayLabel}` : "Late fee",
              amount: fineAmount,
            },
          });
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { totalAmount: toNumber(invoice.totalAmount) + fineAmount },
          });
          invoiceCharged = true;
        }
        if (invoiceCharged) charged++;
      }
      return charged;
    });
  }
}
