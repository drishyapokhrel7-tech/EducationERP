"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { EntityCard } from "@/components/dashboard/entity-card";
import { api } from "@/lib/api";
import { statusVariant } from "@/lib/status-variant";
import { downloadBlob } from "@/lib/download";
import { submitAction, submitDelete, errorMessage } from "@/lib/submit-action";
import { toast } from "sonner";
import type {
  AccountRecord,
  AccountType,
  JournalEntryRecord,
  JournalEntryStatus,
  AnalyticsExportFormat,
} from "@education-erp/api-client";

function formatMoney(amount: number) {
  return `NPR ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "ASSET", label: "Asset" },
  { value: "LIABILITY", label: "Liability" },
  { value: "EQUITY", label: "Equity" },
  { value: "INCOME", label: "Income" },
  { value: "EXPENSE", label: "Expense" },
];

function journalEntryStatusVariant(status: JournalEntryStatus) {
  return status === "VOID" ? "destructive" : statusVariant(status);
}

function ExportButtons({ onCsv, onXlsx, onPdf }: { onCsv: () => void; onXlsx: () => void; onPdf: () => void }) {
  return (
    <div className="flex gap-2">
      <Button type="button" size="sm" variant="outline" onClick={onCsv}>
        Export CSV
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={onXlsx}>
        Export Excel
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={onPdf}>
        Export PDF
      </Button>
    </div>
  );
}

export default function AccountingPage() {
  // ── Chart of Accounts ────────────────────────────────────────────────
  const accounts = useSWR("accounting-accounts", () => api.listAccounts());
  const [accountForm, setAccountForm] = useState<{ code: string; name: string; type: AccountType; description: string }>({
    code: "",
    name: "",
    type: "ASSET",
    description: "",
  });
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editAccountForm, setEditAccountForm] = useState({ name: "", description: "", active: true });

  // ── Journal entries ──────────────────────────────────────────────────
  const journalEntries = useSWR("accounting-journal-entries", () => api.listJournalEntries());
  const [journalDate, setJournalDate] = useState("");
  const [journalMemo, setJournalMemo] = useState("");
  const [journalLines, setJournalLines] = useState([
    { accountId: "", debit: "", credit: "", description: "" },
    { accountId: "", debit: "", credit: "", description: "" },
  ]);
  const journalTotalDebit = journalLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const journalTotalCredit = journalLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const journalBalanced = Math.abs(journalTotalDebit - journalTotalCredit) < 0.01 && journalTotalDebit > 0;

  // ── General ledger ───────────────────────────────────────────────────
  const [ledgerAccountId, setLedgerAccountId] = useState("");
  const ledger = useSWR(ledgerAccountId ? ["accounting-ledger", ledgerAccountId] : null, () =>
    api.getAccountLedger(ledgerAccountId),
  );

  // ── Reports ──────────────────────────────────────────────────────────
  const [trialBalanceAsOf, setTrialBalanceAsOf] = useState("");
  const trialBalance = useSWR(["accounting-trial-balance", trialBalanceAsOf], () =>
    api.getTrialBalance(trialBalanceAsOf || undefined),
  );
  const [balanceSheetAsOf, setBalanceSheetAsOf] = useState("");
  const balanceSheet = useSWR(["accounting-balance-sheet", balanceSheetAsOf], () =>
    api.getBalanceSheet(balanceSheetAsOf || undefined),
  );
  const [incomeFrom, setIncomeFrom] = useState("");
  const [incomeTo, setIncomeTo] = useState("");
  const incomeStatement = useSWR(["accounting-income-statement", incomeFrom, incomeTo], () =>
    api.getIncomeStatement(incomeFrom || undefined, incomeTo || undefined),
  );

  async function handleExport(fetchBlob: () => Promise<Blob>, filename: string) {
    try {
      await downloadBlob(() => fetchBlob(), filename);
    } catch (err) {
      toast.error(errorMessage(err, "Export failed"));
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Accounting</h1>
        <p className="text-muted-foreground text-sm">
          A real double-entry ledger — a Chart of Accounts, a Journal, and the reports (Trial Balance, Balance
          Sheet, Income Statement) computed live from it. Invoices, payments, discounts, refunds, and payroll all
          post here automatically; you can also record a manual journal entry directly.
        </p>
      </div>

      <EntityCard
        id="chart-of-accounts"
        title="Chart of accounts"
        emptyLabel="No accounts yet."
        items={accounts.data}
        error={!!accounts.error}
        onRetry={() => accounts.mutate()}
        renderItem={(a: AccountRecord) => (
          <div className="flex items-center justify-between gap-2">
            <span>
              {a.code} — {a.name}{" "}
              <span className="text-muted-foreground">
                ({ACCOUNT_TYPES.find((t) => t.value === a.type)?.label}
                {a.isSystemAccount ? " · system" : ""}
                {!a.active ? " · inactive" : ""})
              </span>
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingAccountId(a.id);
                  setEditAccountForm({ name: a.name, description: a.description ?? "", active: a.active });
                }}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={a.isSystemAccount}
                title={a.isSystemAccount ? "System accounts can't be deleted" : undefined}
                onClick={() => submitDelete(() => api.deleteAccount(a.id), () => accounts.mutate())}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
        footer={
          editingAccountId ? (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                submitAction(
                  () => api.updateAccount(editingAccountId, editAccountForm),
                  () => {
                    setEditingAccountId(null);
                    accounts.mutate();
                  },
                );
              }}
            >
              <div className="space-y-2">
                <Label className="text-xs">Name</Label>
                <Input value={editAccountForm.name} onChange={(e) => setEditAccountForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Description</Label>
                <Input
                  value={editAccountForm.description}
                  onChange={(e) => setEditAccountForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Status</Label>
                <NativeSelect
                  className="w-28"
                  placeholder="Status"
                  value={editAccountForm.active ? "active" : "inactive"}
                  onChange={(v) => setEditAccountForm((f) => ({ ...f, active: v === "active" }))}
                  options={[
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
                  ]}
                />
              </div>
              <Button type="submit" size="sm">
                Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingAccountId(null)}>
                Cancel
              </Button>
            </form>
          ) : null
        }
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submitAction(
              () =>
                api.createAccount({
                  code: accountForm.code,
                  name: accountForm.name,
                  type: accountForm.type,
                  description: accountForm.description || undefined,
                }),
              () => {
                setAccountForm({ code: "", name: "", type: "ASSET", description: "" });
                accounts.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label className="text-xs">Code</Label>
            <Input
              className="w-24"
              value={accountForm.code}
              onChange={(e) => setAccountForm((f) => ({ ...f, code: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Name</Label>
            <Input value={accountForm.name} onChange={(e) => setAccountForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Type</Label>
            <NativeSelect
              className="w-32"
              placeholder="Select type"
              value={accountForm.type}
              onChange={(v) => setAccountForm((f) => ({ ...f, type: v as AccountType }))}
              options={ACCOUNT_TYPES}
            />
          </div>
          <Button type="submit" size="sm" disabled={!accountForm.code || !accountForm.name}>
            Add account
          </Button>
        </form>
      </EntityCard>

      <EntityCard
        id="journal-entries"
        title="Journal entries"
        emptyLabel="No journal entries yet."
        items={journalEntries.data}
        error={!!journalEntries.error}
        onRetry={() => journalEntries.mutate()}
        renderItem={(entry: JournalEntryRecord) => (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span>
                <span className="font-medium">{entry.entryNumber ?? entry.id}</span>{" "}
                <span className="text-muted-foreground">
                  {new Date(entry.date).toLocaleDateString()} — {entry.memo}
                </span>
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{entry.source}</Badge>
                <Badge variant={journalEntryStatusVariant(entry.status)}>{entry.status}</Badge>
                {entry.status === "POSTED" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => submitAction(() => api.voidJournalEntry(entry.id), () => journalEntries.mutate())}
                  >
                    Void
                  </Button>
                ) : null}
              </div>
            </div>
            <ul className="text-muted-foreground pl-4 text-xs">
              {entry.lines.map((line) => (
                <li key={line.id}>
                  {line.account.code} {line.account.name} — {Number(line.debit) > 0 ? `Dr ${formatMoney(Number(line.debit))}` : `Cr ${formatMoney(Number(line.credit))}`}
                </li>
              ))}
            </ul>
          </div>
        )}
      >
        <form
          className="space-y-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submitAction(
              () =>
                api.createJournalEntry({
                  date: journalDate,
                  memo: journalMemo,
                  lines: journalLines.map((l) => ({
                    accountId: l.accountId,
                    debit: l.debit ? Number(l.debit) : undefined,
                    credit: l.credit ? Number(l.credit) : undefined,
                    description: l.description || undefined,
                  })),
                }),
              () => {
                setJournalDate("");
                setJournalMemo("");
                setJournalLines([
                  { accountId: "", debit: "", credit: "", description: "" },
                  { accountId: "", debit: "", credit: "", description: "" },
                ]);
                journalEntries.mutate();
              },
            );
          }}
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Date</Label>
              <Input type="date" className="w-40" value={journalDate} onChange={(e) => setJournalDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Memo</Label>
              <Input className="w-64" value={journalMemo} onChange={(e) => setJournalMemo(e.target.value)} />
            </div>
          </div>

          <p className="text-muted-foreground text-xs font-medium">
            Lines (exactly one of debit/credit per line — must balance to record)
          </p>
          {journalLines.map((line, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Account</Label>
                <NativeSelect
                  className="w-52"
                  placeholder="Select account"
                  value={line.accountId}
                  onChange={(v) => setJournalLines((rows) => rows.map((r, ri) => (ri === i ? { ...r, accountId: v } : r)))}
                  options={(accounts.data ?? []).map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Debit</Label>
                <Input
                  type="number"
                  className="h-8 w-28"
                  value={line.debit}
                  onChange={(e) =>
                    setJournalLines((rows) =>
                      rows.map((r, ri) => (ri === i ? { ...r, debit: e.target.value, credit: "" } : r)),
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Credit</Label>
                <Input
                  type="number"
                  className="h-8 w-28"
                  value={line.credit}
                  onChange={(e) =>
                    setJournalLines((rows) =>
                      rows.map((r, ri) => (ri === i ? { ...r, credit: e.target.value, debit: "" } : r)),
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Input
                  className="h-8 w-40"
                  value={line.description}
                  onChange={(e) =>
                    setJournalLines((rows) => rows.map((r, ri) => (ri === i ? { ...r, description: e.target.value } : r)))
                  }
                />
              </div>
              {journalLines.length > 2 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => setJournalLines((rows) => rows.filter((_, ri) => ri !== i))}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          ))}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setJournalLines((rows) => [...rows, { accountId: "", debit: "", credit: "", description: "" }])}
            >
              Add line
            </Button>
            <span className={`text-xs ${journalBalanced ? "text-muted-foreground" : "text-destructive"}`}>
              Debit {formatMoney(journalTotalDebit)} · Credit {formatMoney(journalTotalCredit)}
              {!journalBalanced ? " — does not balance yet" : ""}
            </span>
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={!journalDate || !journalMemo || !journalBalanced || journalLines.some((l) => !l.accountId)}
          >
            Record entry
          </Button>
        </form>
      </EntityCard>

      <Card id="general-ledger">
        <CardHeader>
          <CardTitle>General ledger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Account</Label>
            <NativeSelect
              className="w-64"
              placeholder="Select an account"
              value={ledgerAccountId}
              onChange={setLedgerAccountId}
              options={(accounts.data ?? []).map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
            />
          </div>
          {!ledgerAccountId ? null : !ledger.data ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : ledger.data.lines.length === 0 ? (
            <p className="text-muted-foreground text-sm">No activity posted to this account yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-left text-xs">
                    <th className="pb-2 pr-3">Date</th>
                    <th className="pb-2 pr-3">Entry</th>
                    <th className="pb-2 pr-3">Memo</th>
                    <th className="pb-2 pr-3 text-right">Debit</th>
                    <th className="pb-2 pr-3 text-right">Credit</th>
                    <th className="pb-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ledger.data.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="py-2 pr-3">{new Date(line.date).toLocaleDateString()}</td>
                      <td className="py-2 pr-3">{line.entryNumber ?? line.journalEntryId}</td>
                      <td className="py-2 pr-3">{line.description ?? line.memo}</td>
                      <td className="py-2 pr-3 text-right">{line.debit > 0 ? formatMoney(line.debit) : ""}</td>
                      <td className="py-2 pr-3 text-right">{line.credit > 0 ? formatMoney(line.credit) : ""}</td>
                      <td className="py-2 text-right font-medium">{formatMoney(line.runningBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card id="trial-balance">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Trial balance</CardTitle>
          <ExportButtons
            onCsv={() => handleExport(() => api.exportTrialBalance("csv" as AnalyticsExportFormat, trialBalanceAsOf || undefined), "trial-balance.csv")}
            onXlsx={() => handleExport(() => api.exportTrialBalance("xlsx" as AnalyticsExportFormat, trialBalanceAsOf || undefined), "trial-balance.xlsx")}
            onPdf={() => handleExport(() => api.exportTrialBalance("pdf" as AnalyticsExportFormat, trialBalanceAsOf || undefined), "trial-balance.pdf")}
          />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label className="text-xs">As of</Label>
            <Input type="date" className="w-40" value={trialBalanceAsOf} onChange={(e) => setTrialBalanceAsOf(e.target.value)} />
          </div>
          {!trialBalance.data ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : trialBalance.data.rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No activity posted yet.</p>
          ) : (
            <>
              <ul className="divide-y text-sm">
                {trialBalance.data.rows.map((row) => (
                  <li key={row.account.id} className="flex items-center justify-between py-1">
                    <span>
                      {row.account.code} — {row.account.name}
                    </span>
                    <span className="text-muted-foreground">
                      {row.debit > 0 ? `Dr ${formatMoney(row.debit)}` : `Cr ${formatMoney(row.credit)}`}
                    </span>
                  </li>
                ))}
              </ul>
              <Separator />
              <p className="flex items-center justify-between text-sm font-medium">
                <span>Total</span>
                <span>
                  Dr {formatMoney(trialBalance.data.totalDebit)} · Cr {formatMoney(trialBalance.data.totalCredit)}
                </span>
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card id="balance-sheet">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Balance sheet</CardTitle>
          <ExportButtons
            onCsv={() => handleExport(() => api.exportBalanceSheet("csv" as AnalyticsExportFormat, balanceSheetAsOf || undefined), "balance-sheet.csv")}
            onXlsx={() => handleExport(() => api.exportBalanceSheet("xlsx" as AnalyticsExportFormat, balanceSheetAsOf || undefined), "balance-sheet.xlsx")}
            onPdf={() => handleExport(() => api.exportBalanceSheet("pdf" as AnalyticsExportFormat, balanceSheetAsOf || undefined), "balance-sheet.pdf")}
          />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label className="text-xs">As of</Label>
            <Input type="date" className="w-40" value={balanceSheetAsOf} onChange={(e) => setBalanceSheetAsOf(e.target.value)} />
          </div>
          {!balanceSheet.data ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium">Assets</p>
                <ul className="text-sm">
                  {balanceSheet.data.assets.map((r) => (
                    <li key={r.account.id} className="flex items-center justify-between py-1">
                      <span>{r.account.name}</span>
                      <span>{formatMoney(r.balance)}</span>
                    </li>
                  ))}
                </ul>
                <p className="flex items-center justify-between border-t pt-1 text-sm font-medium">
                  <span>Total assets</span>
                  <span>{formatMoney(balanceSheet.data.totalAssets)}</span>
                </p>
              </div>
              <div>
                <p className="text-xs font-medium">Liabilities & equity</p>
                <ul className="text-sm">
                  {balanceSheet.data.liabilities.map((r) => (
                    <li key={r.account.id} className="flex items-center justify-between py-1">
                      <span>{r.account.name}</span>
                      <span>{formatMoney(r.balance)}</span>
                    </li>
                  ))}
                  {balanceSheet.data.equity.map((r) => (
                    <li key={r.account.id} className="flex items-center justify-between py-1">
                      <span>{r.account.name}</span>
                      <span>{formatMoney(r.balance)}</span>
                    </li>
                  ))}
                  <li className="flex items-center justify-between py-1">
                    <span>Retained earnings</span>
                    <span>{formatMoney(balanceSheet.data.retainedEarnings)}</span>
                  </li>
                </ul>
                <p className="flex items-center justify-between border-t pt-1 text-sm font-medium">
                  <span>Total liabilities & equity</span>
                  <span>{formatMoney(balanceSheet.data.totalLiabilities + balanceSheet.data.totalEquity)}</span>
                </p>
              </div>
              <p className={`sm:col-span-2 text-xs ${balanceSheet.data.balanced ? "text-muted-foreground" : "text-destructive"}`}>
                {balanceSheet.data.balanced ? "Balanced." : "Does not balance — this indicates a posting bug."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card id="income-statement">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Income statement</CardTitle>
          <ExportButtons
            onCsv={() => handleExport(() => api.exportIncomeStatement("csv" as AnalyticsExportFormat, incomeFrom || undefined, incomeTo || undefined), "income-statement.csv")}
            onXlsx={() => handleExport(() => api.exportIncomeStatement("xlsx" as AnalyticsExportFormat, incomeFrom || undefined, incomeTo || undefined), "income-statement.xlsx")}
            onPdf={() => handleExport(() => api.exportIncomeStatement("pdf" as AnalyticsExportFormat, incomeFrom || undefined, incomeTo || undefined), "income-statement.pdf")}
          />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label className="text-xs">From</Label>
              <Input type="date" className="w-40" value={incomeFrom} onChange={(e) => setIncomeFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">To</Label>
              <Input type="date" className="w-40" value={incomeTo} onChange={(e) => setIncomeTo(e.target.value)} />
            </div>
          </div>
          {!incomeStatement.data ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <>
              <div>
                <p className="text-xs font-medium">Income</p>
                <ul className="text-sm">
                  {incomeStatement.data.income.map((r) => (
                    <li key={r.account.id} className="flex items-center justify-between py-1">
                      <span>{r.account.name}</span>
                      <span>{formatMoney(r.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium">Expenses</p>
                <ul className="text-sm">
                  {incomeStatement.data.expenses.map((r) => (
                    <li key={r.account.id} className="flex items-center justify-between py-1">
                      <span>{r.account.name}</span>
                      <span>{formatMoney(r.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Separator />
              <p className="flex items-center justify-between text-sm font-medium">
                <span>Net income</span>
                <span>{formatMoney(incomeStatement.data.netIncome)}</span>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
