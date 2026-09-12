import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AccountingService } from "./accounting.service";
import { CreateAccountDto } from "./dto/create-account.dto";
import { UpdateAccountDto } from "./dto/update-account.dto";
import { CreateJournalEntryDto, AsOfQueryDto, LedgerQueryDto, PeriodQueryDto } from "./dto/create-journal-entry.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";
import { sendTableResponse } from "../../common/send-table";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me/accounting")
export class AccountingController {
  constructor(private readonly accounting: AccountingService) {}

  // ── Chart of Accounts ────────────────────────────────────────────────

  @Get("accounts")
  @RequirePermissions("accounting:view")
  listAccounts(@CurrentUser() user: JwtPayload) {
    return this.accounting.listAccounts(user.organizationId);
  }

  @Post("accounts")
  @RequirePermissions("accounting:create")
  createAccount(@CurrentUser() user: JwtPayload, @Body() dto: CreateAccountDto) {
    return this.accounting.createAccount(user.organizationId, dto);
  }

  @Patch("accounts/:id")
  @RequirePermissions("accounting:update")
  updateAccount(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateAccountDto) {
    return this.accounting.updateAccount(user.organizationId, id, dto);
  }

  @Delete("accounts/:id")
  @RequirePermissions("accounting:delete")
  deleteAccount(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.accounting.deleteAccount(user.organizationId, id);
  }

  @Get("accounts/:id/ledger")
  @RequirePermissions("accounting:view")
  getAccountLedger(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Query() query: LedgerQueryDto) {
    return this.accounting.getAccountLedger(user.organizationId, id, query);
  }

  // ── Journal entries ──────────────────────────────────────────────────

  @Get("journal-entries")
  @RequirePermissions("accounting:view")
  listJournalEntries(@CurrentUser() user: JwtPayload) {
    return this.accounting.listJournalEntries(user.organizationId);
  }

  @Get("journal-entries/:id")
  @RequirePermissions("accounting:view")
  getJournalEntry(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.accounting.getJournalEntry(user.organizationId, id);
  }

  @Post("journal-entries")
  @RequirePermissions("accounting:create")
  createJournalEntry(@CurrentUser() user: JwtPayload, @Body() dto: CreateJournalEntryDto) {
    return this.accounting.createJournalEntry(user.organizationId, user.sub, dto);
  }

  @Post("journal-entries/:id/void")
  @RequirePermissions("accounting:update")
  voidJournalEntry(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.accounting.voidJournalEntry(user.organizationId, id);
  }

  // ── Reports ──────────────────────────────────────────────────────────

  @Get("reports/trial-balance")
  @RequirePermissions("accounting:view")
  getTrialBalance(@CurrentUser() user: JwtPayload, @Query() query: AsOfQueryDto) {
    return this.accounting.getTrialBalance(user.organizationId, query.asOf);
  }

  @Get("reports/trial-balance/export")
  @RequirePermissions("accounting:export")
  async exportTrialBalance(
    @CurrentUser() user: JwtPayload,
    @Query("asOf") asOf: string | undefined,
    @Query("format") format: string,
    @Res() res: Response,
  ) {
    const table = await this.accounting.exportTrialBalance(user.organizationId, asOf);
    await sendTableResponse(res, table, "trial-balance", "Trial Balance", format);
  }

  @Get("reports/balance-sheet")
  @RequirePermissions("accounting:view")
  getBalanceSheet(@CurrentUser() user: JwtPayload, @Query() query: AsOfQueryDto) {
    return this.accounting.getBalanceSheet(user.organizationId, query.asOf);
  }

  @Get("reports/balance-sheet/export")
  @RequirePermissions("accounting:export")
  async exportBalanceSheet(
    @CurrentUser() user: JwtPayload,
    @Query("asOf") asOf: string | undefined,
    @Query("format") format: string,
    @Res() res: Response,
  ) {
    const table = await this.accounting.exportBalanceSheet(user.organizationId, asOf);
    await sendTableResponse(res, table, "balance-sheet", "Balance Sheet", format);
  }

  @Get("reports/income-statement")
  @RequirePermissions("accounting:view")
  getIncomeStatement(@CurrentUser() user: JwtPayload, @Query() query: PeriodQueryDto) {
    return this.accounting.getIncomeStatement(user.organizationId, query);
  }

  @Get("reports/income-statement/export")
  @RequirePermissions("accounting:export")
  async exportIncomeStatement(
    @CurrentUser() user: JwtPayload,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @Query("format") format: string,
    @Res() res: Response,
  ) {
    const table = await this.accounting.exportIncomeStatement(user.organizationId, from, to);
    await sendTableResponse(res, table, "income-statement", "Income Statement", format);
  }
}
