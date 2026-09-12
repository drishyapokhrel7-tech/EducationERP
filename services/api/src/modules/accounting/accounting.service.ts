import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Account, AccountType, JournalEntrySource, Prisma, PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { assertNoDependents } from "../../common/assert-no-dependents";
import { ExportTable } from "../analytics/export-helpers";
import { CreateAccountDto } from "./dto/create-account.dto";
import { UpdateAccountDto } from "./dto/update-account.dto";
import { CreateJournalEntryDto } from "./dto/create-journal-entry.dto";

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

// ASSET/EXPENSE accounts increase with a debit ("debit-normal");
// LIABILITY/EQUITY/INCOME increase with a credit. Every report below
// (ledger running balance, trial balance, balance sheet, income
// statement) nets a raw debit/credit total into this one signed
// number so each account's activity always reads as a single,
// correctly-signed figure rather than two columns callers have to
// interpret themselves.
function isDebitNormal(type: AccountType): boolean {
  return type === "ASSET" || type === "EXPENSE";
}

function normalBalance(type: AccountType, totalDebit: number, totalCredit: number): number {
  const net = totalDebit - totalCredit;
  return isDebitNormal(type) ? net : -net;
}

// A hard, code-level invariant, not a user input mistake — every
// posting rule below builds its own lines, so if this ever trips it's
// a bug in one of those rules, not something a caller could have
// avoided. Manual entries get their own, HTTP-facing version of this
// same check in createJournalEntry.
function assertSystemEntryBalances(source: JournalEntrySource, sourceId: string, lines: { debit?: number; credit?: number }[]): void {
  const totalDebit = lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Unbalanced system journal entry for ${source} ${sourceId}: debit ${totalDebit} != credit ${totalCredit}`);
  }
}

const DEFAULT_ACCOUNTS: { code: string; name: string; type: AccountType }[] = [
  { code: "1000", name: "Cash", type: "ASSET" },
  { code: "1010", name: "Bank", type: "ASSET" },
  { code: "1100", name: "Accounts Receivable", type: "ASSET" },
  { code: "2100", name: "Salary Payable", type: "LIABILITY" },
  { code: "2200", name: "Deductions Payable", type: "LIABILITY" },
  { code: "3000", name: "Retained Earnings", type: "EQUITY" },
  { code: "4000", name: "Fee Revenue", type: "INCOME" },
  { code: "5000", name: "Salary Expense", type: "EXPENSE" },
  { code: "5100", name: "Scholarship & Discount Expense", type: "EXPENSE" },
  { code: "5200", name: "Refund Expense", type: "EXPENSE" },
];

interface JournalLineInput {
  accountId: string;
  debit?: number;
  credit?: number;
  description?: string | null;
}

@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Chart of Accounts ────────────────────────────────────────────────

  // Idempotent (skipDuplicates, keyed on the organizationId+code unique
  // constraint) — called at the top of every read/write below, not
  // just once at org-creation time, so the 148 organizations that
  // already existed when this module shipped (and every org created
  // after) get a working chart the first time anything here actually
  // runs. No migration data script, no manual step.
  private async ensureDefaultAccounts(tx: PrismaClient, organizationId: string): Promise<void> {
    await tx.account.createMany({
      data: DEFAULT_ACCOUNTS.map((a) => ({
        organizationId,
        code: a.code,
        name: a.name,
        type: a.type,
        isSystemAccount: true,
      })),
      skipDuplicates: true,
    });
  }

  private async getSystemAccount(tx: PrismaClient, organizationId: string, code: string): Promise<Account> {
    const account = await tx.account.findUnique({ where: { organizationId_code: { organizationId, code } } });
    if (!account) {
      // ensureDefaultAccounts is always called first by every public
      // method on this service, so this only fires if a well-known
      // system account was renamed/miscoded some other way — a real
      // bug, not something a caller triggered.
      throw new Error(`System account ${code} missing for organization ${organizationId}`);
    }
    return account;
  }

  private cashOrBankAccountCode(method: string): string {
    return method === "CASH" ? "1000" : "1010";
  }

  private async loadAccount(tx: PrismaClient, organizationId: string, id: string): Promise<Account> {
    const account = await tx.account.findUnique({ where: { id } });
    if (!account || account.organizationId !== organizationId) throw new NotFoundException("Account not found");
    return account;
  }

  async listAccounts(organizationId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.ensureDefaultAccounts(tx, organizationId);
      return tx.account.findMany({ where: { organizationId }, orderBy: { code: "asc" } });
    });
  }

  async createAccount(organizationId: string, dto: CreateAccountDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.ensureDefaultAccounts(tx, organizationId);
      if (dto.parentId) {
        const parent = await tx.account.findUnique({ where: { id: dto.parentId } });
        if (!parent || parent.organizationId !== organizationId) {
          throw new NotFoundException("Parent account not found");
        }
      }
      try {
        return await tx.account.create({
          data: {
            organizationId,
            code: dto.code,
            name: dto.name,
            type: dto.type,
            parentId: dto.parentId,
            description: dto.description,
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new ConflictException(`An account with code "${dto.code}" already exists`);
        }
        throw err;
      }
    });
  }

  async updateAccount(organizationId: string, id: string, dto: UpdateAccountDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const account = await this.loadAccount(tx, organizationId, id);
      return tx.account.update({
        where: { id: account.id },
        data: { name: dto.name, description: dto.description, active: dto.active },
      });
    });
  }

  async deleteAccount(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const account = await this.loadAccount(tx, organizationId, id);
      if (account.isSystemAccount) {
        throw new ConflictException("A system account cannot be deleted");
      }
      await assertNoDependents(
        [
          tx.journalLine.count({ where: { accountId: id } }),
          tx.account.count({ where: { parentId: id } }),
          tx.feeCategory.count({ where: { revenueAccountId: id } }),
        ],
        "account",
      );
      await tx.account.delete({ where: { id } });
      return { deleted: true as const };
    });
  }

  async getAccountLedger(organizationId: string, accountId: string, query: { from?: string; to?: string }) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const account = await this.loadAccount(tx, organizationId, accountId);
      const allLines = await tx.journalLine.findMany({
        where: { accountId, organizationId, journalEntry: { status: { not: "VOID" } } },
        include: { journalEntry: true },
        orderBy: { journalEntry: { date: "asc" } },
      });
      // The running balance is computed over an account's ENTIRE
      // history up to each line, then filtered to the requested
      // window — so a `from` date still shows a correct opening
      // balance instead of resetting to zero at the window's edge.
      const sign = isDebitNormal(account.type) ? 1 : -1;
      let balance = 0;
      const rows: { line: (typeof allLines)[number]; runningBalance: number }[] = [];
      for (const line of allLines) {
        balance += sign * (toNumber(line.debit) - toNumber(line.credit));
        const date = line.journalEntry.date;
        if (query.from && date < new Date(query.from)) continue;
        if (query.to && date > new Date(query.to)) continue;
        rows.push({ line, runningBalance: balance });
      }
      return {
        account,
        lines: rows.map((r) => ({
          id: r.line.id,
          journalEntryId: r.line.journalEntryId,
          date: r.line.journalEntry.date,
          entryNumber: r.line.journalEntry.entryNumber,
          memo: r.line.journalEntry.memo,
          description: r.line.description,
          debit: toNumber(r.line.debit),
          credit: toNumber(r.line.credit),
          runningBalance: r.runningBalance,
        })),
      };
    });
  }

  // ── Journal entries ──────────────────────────────────────────────────

  private async nextEntryNumber(tx: PrismaClient, organizationId: string): Promise<string> {
    const count = await tx.journalEntry.count({ where: { organizationId } });
    return `JE-${String(count + 1).padStart(6, "0")}`;
  }

  // Same collision-retry shape as FinanceService's
  // createInvoiceWithNumber/createPaymentWithNumber — entryNumber has
  // a per-org unique constraint, so a count-based number can
  // theoretically collide under concurrent posts.
  private async createEntryWithNumber(
    tx: PrismaClient,
    organizationId: string,
    data: {
      date: Date;
      memo: string;
      source: JournalEntrySource;
      sourceId?: string | null;
      reversalOfId?: string | null;
      createdBy?: string | null;
      lines: JournalLineInput[];
    },
  ) {
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const entryNumber = await this.nextEntryNumber(tx, organizationId);
      try {
        return await tx.journalEntry.create({
          data: {
            organizationId,
            entryNumber,
            date: data.date,
            memo: data.memo,
            source: data.source,
            sourceId: data.sourceId,
            reversalOfId: data.reversalOfId,
            createdBy: data.createdBy,
            lines: {
              create: data.lines.map((l) => ({
                organizationId,
                accountId: l.accountId,
                debit: l.debit ?? 0,
                credit: l.credit ?? 0,
                description: l.description ?? undefined,
              })),
            },
          },
          include: { lines: { include: { account: true } }, creator: { select: { firstName: true, lastName: true } } },
        });
      } catch (err) {
        const isUniqueViolation = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
        if (!isUniqueViolation || attempt === maxAttempts) throw err;
      }
    }
    throw new Error("Could not generate a unique journal entry number — please try again");
  }

  async listJournalEntries(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.journalEntry.findMany({
        where: { organizationId },
        orderBy: { date: "desc" },
        include: { lines: { include: { account: true } }, creator: { select: { firstName: true, lastName: true } } },
      }),
    );
  }

  async getJournalEntry(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const entry = await tx.journalEntry.findUnique({
        where: { id },
        include: { lines: { include: { account: true } }, creator: { select: { firstName: true, lastName: true } } },
      });
      if (!entry || entry.organizationId !== organizationId) throw new NotFoundException("Journal entry not found");
      return entry;
    });
  }

  async createJournalEntry(organizationId: string, userId: string, dto: CreateJournalEntryDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.ensureDefaultAccounts(tx, organizationId);

      for (const line of dto.lines) {
        const hasDebit = (line.debit ?? 0) > 0;
        const hasCredit = (line.credit ?? 0) > 0;
        if (hasDebit === hasCredit) {
          throw new BadRequestException("Each journal line must have exactly one of debit or credit greater than zero");
        }
      }
      const totalDebit = dto.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
      const totalCredit = dto.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new BadRequestException(
          `Journal entry does not balance — total debit (${totalDebit}) must equal total credit (${totalCredit})`,
        );
      }
      for (const line of dto.lines) {
        const account = await tx.account.findUnique({ where: { id: line.accountId } });
        if (!account || account.organizationId !== organizationId) {
          throw new NotFoundException(`Account not found: ${line.accountId}`);
        }
      }

      return this.createEntryWithNumber(tx, organizationId, {
        date: new Date(dto.date),
        memo: dto.memo,
        source: "MANUAL",
        createdBy: userId,
        lines: dto.lines,
      });
    });
  }

  // Never deletes a posted entry — same append-only-audit precedent as
  // FinancialTransaction/Refund. Flips status to VOID and posts a
  // separate reversing entry with every line's debit/credit swapped,
  // netting the original to zero rather than erasing it.
  async voidJournalEntry(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const entry = await tx.journalEntry.findUnique({ where: { id }, include: { lines: true } });
      if (!entry || entry.organizationId !== organizationId) throw new NotFoundException("Journal entry not found");
      if (entry.status === "VOID") throw new ConflictException("This journal entry is already void");

      const reversal = await this.createEntryWithNumber(tx, organizationId, {
        date: new Date(),
        memo: `Reversal of ${entry.entryNumber ?? entry.id}`,
        source: entry.source,
        sourceId: entry.sourceId,
        reversalOfId: entry.id,
        lines: entry.lines.map((l) => ({
          accountId: l.accountId,
          debit: toNumber(l.credit),
          credit: toNumber(l.debit),
          description: l.description,
        })),
      });
      await tx.journalEntry.update({ where: { id }, data: { status: "VOID" } });
      return reversal;
    });
  }

  // ── Reports ──────────────────────────────────────────────────────────

  async getTrialBalance(organizationId: string, asOf?: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.ensureDefaultAccounts(tx, organizationId);
      const asOfDate = asOf ? new Date(asOf) : new Date();
      const [accounts, lines] = await Promise.all([
        tx.account.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
        tx.journalLine.findMany({
          where: { organizationId, journalEntry: { status: { not: "VOID" }, date: { lte: asOfDate } } },
        }),
      ]);
      const totals = new Map<string, { debit: number; credit: number }>();
      for (const line of lines) {
        const t = totals.get(line.accountId) ?? { debit: 0, credit: 0 };
        t.debit += toNumber(line.debit);
        t.credit += toNumber(line.credit);
        totals.set(line.accountId, t);
      }
      const rows = accounts
        .map((account) => {
          const t = totals.get(account.id) ?? { debit: 0, credit: 0 };
          // Net into whichever side is this account's normal balance —
          // the same presentation every real trial balance uses (a
          // "Cash" account debited $500 and credited $100 over its
          // life shows as $400 debit, not both raw totals). normalBalance
          // returns a positive number when the account sits on its own
          // normal side (debit for ASSET/EXPENSE, credit for
          // LIABILITY/EQUITY/INCOME) — so which physical column that
          // positive number lands in still depends on which side is
          // "normal" for this account's type, not on the sign alone.
          // (Bug fixed here: an earlier version put every positive
          // `net` in the debit column regardless of type, which put
          // every credit-normal account's normal balance in the wrong
          // column and made totalDebit != totalCredit.)
          const net = normalBalance(account.type, t.debit, t.credit);
          const normalIsDebit = isDebitNormal(account.type);
          return {
            account,
            debit: normalIsDebit ? Math.max(net, 0) : Math.max(-net, 0),
            credit: normalIsDebit ? Math.max(-net, 0) : Math.max(net, 0),
          };
        })
        .filter((row) => row.debit !== 0 || row.credit !== 0);
      const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
      const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
      return { asOf: asOfDate.toISOString(), rows, totalDebit, totalCredit };
    });
  }

  async getBalanceSheet(organizationId: string, asOf?: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.ensureDefaultAccounts(tx, organizationId);
      const asOfDate = asOf ? new Date(asOf) : new Date();
      const [accounts, lines] = await Promise.all([
        tx.account.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
        tx.journalLine.findMany({
          where: { organizationId, journalEntry: { status: { not: "VOID" }, date: { lte: asOfDate } } },
        }),
      ]);
      const totals = new Map<string, { debit: number; credit: number }>();
      for (const line of lines) {
        const t = totals.get(line.accountId) ?? { debit: 0, credit: 0 };
        t.debit += toNumber(line.debit);
        t.credit += toNumber(line.credit);
        totals.set(line.accountId, t);
      }
      const balanceOf = (account: Account) => {
        const t = totals.get(account.id) ?? { debit: 0, credit: 0 };
        return normalBalance(account.type, t.debit, t.credit);
      };
      const rowsFor = (type: AccountType) =>
        accounts
          .filter((a) => a.type === type)
          .map((account) => ({ account, balance: balanceOf(account) }))
          .filter((row) => row.balance !== 0);

      const assets = rowsFor("ASSET");
      const liabilities = rowsFor("LIABILITY");
      const equity = rowsFor("EQUITY");

      // Retained Earnings is computed cumulative (Income − Expense
      // through asOf), not a stored/closed balance — no period-closing
      // workflow in this pass (see the plan's own reasoning), which
      // keeps this always correct without one.
      const incomeTotal = accounts.filter((a) => a.type === "INCOME").reduce((s, a) => s + balanceOf(a), 0);
      const expenseTotal = accounts.filter((a) => a.type === "EXPENSE").reduce((s, a) => s + balanceOf(a), 0);
      const retainedEarnings = incomeTotal - expenseTotal;

      const totalAssets = assets.reduce((s, r) => s + r.balance, 0);
      const totalLiabilities = liabilities.reduce((s, r) => s + r.balance, 0);
      const totalEquity = equity.reduce((s, r) => s + r.balance, 0) + retainedEarnings;

      return {
        asOf: asOfDate.toISOString(),
        assets,
        liabilities,
        equity,
        retainedEarnings,
        totalAssets,
        totalLiabilities,
        totalEquity,
        balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
      };
    });
  }

  async getIncomeStatement(organizationId: string, query: { from?: string; to?: string }) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.ensureDefaultAccounts(tx, organizationId);
      const accounts = await tx.account.findMany({
        where: { organizationId, type: { in: ["INCOME", "EXPENSE"] } },
        orderBy: { code: "asc" },
      });
      const dateFilter: Prisma.JournalEntryWhereInput["date"] = {};
      if (query.from) dateFilter.gte = new Date(query.from);
      if (query.to) dateFilter.lte = new Date(query.to);
      const lines = await tx.journalLine.findMany({
        where: {
          organizationId,
          journalEntry: {
            status: { not: "VOID" },
            ...(query.from || query.to ? { date: dateFilter } : {}),
          },
        },
      });
      const totals = new Map<string, { debit: number; credit: number }>();
      for (const line of lines) {
        const t = totals.get(line.accountId) ?? { debit: 0, credit: 0 };
        t.debit += toNumber(line.debit);
        t.credit += toNumber(line.credit);
        totals.set(line.accountId, t);
      }
      const balanceOf = (account: Account) => {
        const t = totals.get(account.id) ?? { debit: 0, credit: 0 };
        return normalBalance(account.type, t.debit, t.credit);
      };
      const income = accounts
        .filter((a) => a.type === "INCOME")
        .map((account) => ({ account, amount: balanceOf(account) }))
        .filter((r) => r.amount !== 0);
      const expenses = accounts
        .filter((a) => a.type === "EXPENSE")
        .map((account) => ({ account, amount: balanceOf(account) }))
        .filter((r) => r.amount !== 0);
      const totalIncome = income.reduce((s, r) => s + r.amount, 0);
      const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0);
      return {
        from: query.from ?? null,
        to: query.to ?? new Date().toISOString(),
        income,
        expenses,
        totalIncome,
        totalExpenses,
        netIncome: totalIncome - totalExpenses,
      };
    });
  }

  // ── Report exports (csv/xlsx/pdf, via the shared sendTableResponse) ──

  async exportTrialBalance(organizationId: string, asOf?: string): Promise<ExportTable> {
    const { rows, totalDebit, totalCredit } = await this.getTrialBalance(organizationId, asOf);
    return {
      headers: ["Code", "Account", "Type", "Debit", "Credit"],
      rows: [
        ...rows.map((r) => [r.account.code, r.account.name, r.account.type, r.debit.toFixed(2), r.credit.toFixed(2)]),
        ["", "", "Total", totalDebit.toFixed(2), totalCredit.toFixed(2)],
      ],
    };
  }

  async exportBalanceSheet(organizationId: string, asOf?: string): Promise<ExportTable> {
    const sheet = await this.getBalanceSheet(organizationId, asOf);
    const rows: (string | number)[][] = [
      ...sheet.assets.map((r) => ["Asset", r.account.code, r.account.name, r.balance.toFixed(2)]),
      ["", "", "Total Assets", sheet.totalAssets.toFixed(2)],
      ...sheet.liabilities.map((r) => ["Liability", r.account.code, r.account.name, r.balance.toFixed(2)]),
      ["", "", "Total Liabilities", sheet.totalLiabilities.toFixed(2)],
      ...sheet.equity.map((r) => ["Equity", r.account.code, r.account.name, r.balance.toFixed(2)]),
      ["Equity", "3000", "Retained Earnings (computed)", sheet.retainedEarnings.toFixed(2)],
      ["", "", "Total Equity", sheet.totalEquity.toFixed(2)],
    ];
    return { headers: ["Section", "Code", "Account", "Balance"], rows };
  }

  async exportIncomeStatement(organizationId: string, from?: string, to?: string): Promise<ExportTable> {
    const statement = await this.getIncomeStatement(organizationId, { from, to });
    const rows: (string | number)[][] = [
      ...statement.income.map((r) => ["Income", r.account.code, r.account.name, r.amount.toFixed(2)]),
      ["", "", "Total Income", statement.totalIncome.toFixed(2)],
      ...statement.expenses.map((r) => ["Expense", r.account.code, r.account.name, r.amount.toFixed(2)]),
      ["", "", "Total Expenses", statement.totalExpenses.toFixed(2)],
      ["", "", "Net Income", statement.netIncome.toFixed(2)],
    ];
    return { headers: ["Section", "Code", "Account", "Amount"], rows };
  }

  // ── Auto-posting from Finance/Payroll ────────────────────────────────
  // Each takes the caller's already-open tx, so posting is atomic with
  // the source mutation — one withTenant transaction, same as
  // FinancialTransaction today (which stays exactly as it is; this is
  // a second, independent record of the same event).

  async postInvoiceCreated(tx: PrismaClient, organizationId: string, invoiceId: string): Promise<void> {
    await this.ensureDefaultAccounts(tx, organizationId);
    const invoice = await tx.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { items: { include: { feeCategory: true } } },
    });
    const ar = await this.getSystemAccount(tx, organizationId, "1100");
    const fallbackRevenue = await this.getSystemAccount(tx, organizationId, "4000");

    // Grouped by revenue account so several items posting to the same
    // account become one credit line, not one per item.
    const creditsByAccount = new Map<string, number>();
    for (const item of invoice.items) {
      const accountId = item.feeCategory.revenueAccountId ?? fallbackRevenue.id;
      creditsByAccount.set(accountId, (creditsByAccount.get(accountId) ?? 0) + toNumber(item.amount));
    }
    const totalAmount = toNumber(invoice.totalAmount);
    const lines: JournalLineInput[] = [
      { accountId: ar.id, debit: totalAmount, description: `Invoice ${invoice.invoiceNumber ?? invoice.id}` },
      ...[...creditsByAccount.entries()].map(([accountId, amount]) => ({ accountId, credit: amount })),
    ];
    assertSystemEntryBalances("INVOICE", invoice.id, lines);

    await this.createEntryWithNumber(tx, organizationId, {
      date: invoice.createdAt,
      memo: `Invoice ${invoice.invoiceNumber ?? invoice.id} created`,
      source: "INVOICE",
      sourceId: invoice.id,
      lines,
    });
  }

  async postPaymentRecorded(tx: PrismaClient, organizationId: string, paymentId: string): Promise<void> {
    await this.ensureDefaultAccounts(tx, organizationId);
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const cashOrBank = await this.getSystemAccount(tx, organizationId, this.cashOrBankAccountCode(payment.method));
    const ar = await this.getSystemAccount(tx, organizationId, "1100");
    const amount = toNumber(payment.amount);
    await this.createEntryWithNumber(tx, organizationId, {
      date: payment.paidAt,
      memo: `Payment ${payment.receiptNumber ?? payment.id} received`,
      source: "PAYMENT",
      sourceId: payment.id,
      lines: [
        { accountId: cashOrBank.id, debit: amount },
        { accountId: ar.id, credit: amount },
      ],
    });
  }

  async postDiscountApplied(tx: PrismaClient, organizationId: string, discountId: string): Promise<void> {
    await this.ensureDefaultAccounts(tx, organizationId);
    const discount = await tx.discount.findUniqueOrThrow({ where: { id: discountId } });
    const expense = await this.getSystemAccount(tx, organizationId, "5100");
    const ar = await this.getSystemAccount(tx, organizationId, "1100");
    const amount = toNumber(discount.amount);
    await this.createEntryWithNumber(tx, organizationId, {
      date: discount.createdAt,
      memo: `Discount applied: ${discount.reason}`,
      source: "DISCOUNT",
      sourceId: discount.id,
      lines: [
        { accountId: expense.id, debit: amount },
        { accountId: ar.id, credit: amount },
      ],
    });
  }

  async postRefundIssued(tx: PrismaClient, organizationId: string, refundId: string): Promise<void> {
    await this.ensureDefaultAccounts(tx, organizationId);
    const refund = await tx.refund.findUniqueOrThrow({ where: { id: refundId }, include: { payment: true } });
    const expense = await this.getSystemAccount(tx, organizationId, "5200");
    const cashOrBank = await this.getSystemAccount(tx, organizationId, this.cashOrBankAccountCode(refund.payment.method));
    const amount = toNumber(refund.amount);
    await this.createEntryWithNumber(tx, organizationId, {
      date: refund.createdAt,
      memo: `Refund issued: ${refund.reason}`,
      source: "REFUND",
      sourceId: refund.id,
      lines: [
        { accountId: expense.id, debit: amount },
        { accountId: cashOrBank.id, credit: amount },
      ],
    });
  }

  async postPayrollFinalized(tx: PrismaClient, organizationId: string, payrollId: string): Promise<void> {
    await this.ensureDefaultAccounts(tx, organizationId);
    const payroll = await tx.payroll.findUniqueOrThrow({ where: { id: payrollId } });
    const salaryExpense = await this.getSystemAccount(tx, organizationId, "5000");
    const deductionsPayable = await this.getSystemAccount(tx, organizationId, "2200");
    const salaryPayable = await this.getSystemAccount(tx, organizationId, "2100");
    const gross = toNumber(payroll.grossPay);
    const deductions = toNumber(payroll.totalDeductions);
    const net = toNumber(payroll.netPay);
    const lines: JournalLineInput[] = [{ accountId: salaryExpense.id, debit: gross }];
    if (deductions > 0) lines.push({ accountId: deductionsPayable.id, credit: deductions });
    lines.push({ accountId: salaryPayable.id, credit: net });
    assertSystemEntryBalances("PAYROLL", payroll.id, lines);

    await this.createEntryWithNumber(tx, organizationId, {
      date: payroll.finalizedAt ?? new Date(),
      memo: `Payroll finalized for ${payroll.periodMonth}/${payroll.periodYear}`,
      source: "PAYROLL",
      sourceId: payroll.id,
      lines,
    });
  }

  async postPayrollPaid(tx: PrismaClient, organizationId: string, payrollId: string): Promise<void> {
    await this.ensureDefaultAccounts(tx, organizationId);
    const payroll = await tx.payroll.findUniqueOrThrow({ where: { id: payrollId } });
    const salaryPayable = await this.getSystemAccount(tx, organizationId, "2100");
    const cashOrBank = await this.getSystemAccount(tx, organizationId, this.cashOrBankAccountCode(payroll.paymentMethod ?? "CASH"));
    const net = toNumber(payroll.netPay);
    await this.createEntryWithNumber(tx, organizationId, {
      date: payroll.paidAt ?? new Date(),
      memo: `Payroll paid for ${payroll.periodMonth}/${payroll.periodYear}`,
      source: "PAYROLL",
      sourceId: payroll.id,
      lines: [
        { accountId: salaryPayable.id, debit: net },
        { accountId: cashOrBank.id, credit: net },
      ],
    });
  }
}
