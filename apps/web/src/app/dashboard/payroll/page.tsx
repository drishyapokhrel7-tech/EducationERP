"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FeatureLock } from "@/components/feature-lock";
import { api } from "@/lib/api";
import { statusVariant } from "@/lib/status-variant";
import { submitAction, errorMessage } from "@/lib/submit-action";
import type { PayrollItemType, PayrollStatus, PaymentMethod } from "@education-erp/api-client";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// "8/2026" is ambiguous between month-first and day-first conventions
// — spell the month out instead.
function monthYearLabel(month: number, year: number): string {
  return `${MONTHS[month - 1] ?? month} ${year}`;
}

function formatMoney(amount: number | string | null) {
  if (amount == null) return "—";
  return `NPR ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Payroll's own PAID status collides with InvoiceStatus's
// PARTIALLY_PAID substring-wise, so the shared statusVariant() can't
// safely treat "PAID" as success globally — handled locally here.
function payrollStatusVariant(status: PayrollStatus) {
  return status === "PAID" ? "success" : statusVariant(status);
}

const ITEM_TYPES: { value: PayrollItemType; label: string }[] = [
  { value: "EARNING", label: "Earning" },
  { value: "DEDUCTION", label: "Deduction" },
];

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CHEQUE", label: "Cheque" },
];

const STATUS_FILTERS: { value: PayrollStatus; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "FINALIZED", label: "Finalized" },
  { value: "PAID", label: "Paid" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function PayrollPage() {
  // Deliberately the unbounded, narrow picker — this is a "pick a
  // staff member" dropdown, not the paginated admin list view (Phase 8
  // performance-optimization slice).
  const employees = useSWR("employees-picker", () => api.listEmployeesPicker());
  const structures = useSWR("salary-structures", () => api.listSalaryStructures());

  // ── Salary structures ────────────────────────────────────────────────
  const [structureForm, setStructureForm] = useState({ name: "", basicSalary: "" });
  const [structureItems, setStructureItems] = useState([{ type: "EARNING" as PayrollItemType, name: "", amount: "", percentOfBasic: "" }]);

  // ── Assignment ────────────────────────────────────────────────────────
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [assignStructureId, setAssignStructureId] = useState("");

  // ── Generate ──────────────────────────────────────────────────────────
  const now = new Date();
  const [generateForm, setGenerateForm] = useState({ periodMonth: String(now.getMonth() + 1), periodYear: String(now.getFullYear()) });
  const [generateResult, setGenerateResult] = useState<{ generated: string[]; skipped: { employeeId: string; reason: string }[] } | null>(null);
  // Real blast-radius confirm — fetches the actual eligible-employee
  // count and gross total before a payroll run for the whole staff
  // actually fires.
  const [generatePreview, setGeneratePreview] = useState<{
    periodMonth: number;
    periodYear: number;
    eligibleCount: number;
    alreadyGeneratedCount: number;
    grossTotal: number;
  } | null>(null);

  // ── Payroll list ──────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<PayrollStatus | "">("");
  const payrolls = useSWR(["payroll", statusFilter], () => api.listPayroll(statusFilter ? { status: statusFilter } : {}));
  const [activePayrollId, setActivePayrollId] = useState<string | null>(null);
  const activePayroll = useSWR(activePayrollId ? ["payroll-detail", activePayrollId] : null, () => api.getPayroll(activePayrollId as string));
  // Cancelling a still-DRAFT run is low-stakes (nothing was ever
  // finalized) so stays a plain click; cancelling a FINALIZED run is
  // the one this needs a confirm step for — "Cancel" here sits right
  // next to Finalize/Mark paid and reads the same either way.
  const [confirmingCancelFinalized, setConfirmingCancelFinalized] = useState(false);
  const [itemForm, setItemForm] = useState({ type: "EARNING" as PayrollItemType, name: "", amount: "" });
  const [payForm, setPayForm] = useState<PaymentMethod>("CASH");

  const employeeLabel = (id: string) => {
    const e = employees.data?.find((e) => e.id === id);
    return e ? `${e.firstName} ${e.lastName} (${e.employeeCode})` : id;
  };

  return (
    <FeatureLock feature="payroll">
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Payroll</h1>
        <p className="text-muted-foreground text-sm">
          Salary structures, per-employee assignment, and monthly payroll generation with unpaid-leave deductions.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Salary Structures</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!structures.data || structures.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No salary structures yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {structures.data.map((s) => (
                <li key={s.id} className="py-2">
                  <p className="font-medium">
                    {s.name} <span className="text-muted-foreground font-normal">— basic {formatMoney(s.basicSalary)}</span>
                  </p>
                  {s.items.length > 0 ? (
                    <ul className="text-muted-foreground pl-4 text-xs">
                      {s.items.map((i) => (
                        <li key={i.id}>
                          {i.name} ({i.type.toLowerCase()}): {i.percentOfBasic != null ? `${i.percentOfBasic}%` : formatMoney(i.amount ?? null)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <Separator />
          <form
            className="space-y-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submitAction(
                () =>
                  api.createSalaryStructure({
                    name: structureForm.name,
                    basicSalary: Number(structureForm.basicSalary),
                    items: structureItems
                      .filter((i) => i.name && (i.amount || i.percentOfBasic))
                      .map((i) => ({
                        type: i.type,
                        name: i.name,
                        amount: i.amount ? Number(i.amount) : undefined,
                        percentOfBasic: i.percentOfBasic ? Number(i.percentOfBasic) : undefined,
                      })),
                  }),
                () => {
                  setStructureForm({ name: "", basicSalary: "" });
                  setStructureItems([{ type: "EARNING", name: "", amount: "", percentOfBasic: "" }]);
                  structures.mutate();
                },
              );
            }}
          >
            <p className="text-sm font-medium">New salary structure</p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={structureForm.name} onChange={(e) => setStructureForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Basic salary (NPR)</Label>
                <Input
                  type="number"
                  className="w-36"
                  value={structureForm.basicSalary}
                  onChange={(e) => setStructureForm((f) => ({ ...f, basicSalary: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              {structureItems.map((item, idx) => (
                <div key={idx} className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <NativeSelect
                      className="w-32"
                      placeholder="Type"
                      value={item.type}
                      onChange={(v) => setStructureItems((items) => items.map((it, i) => (i === idx ? { ...it, type: v as PayrollItemType } : it)))}
                      options={ITEM_TYPES}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input
                      className="w-40"
                      value={item.name}
                      onChange={(e) => setStructureItems((items) => items.map((it, i) => (i === idx ? { ...it, name: e.target.value } : it)))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Amount (NPR)</Label>
                    <Input
                      type="number"
                      className="w-28"
                      value={item.amount}
                      onChange={(e) =>
                        setStructureItems((items) => items.map((it, i) => (i === idx ? { ...it, amount: e.target.value, percentOfBasic: "" } : it)))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">or % of basic</Label>
                    <Input
                      type="number"
                      className="w-24"
                      value={item.percentOfBasic}
                      onChange={(e) =>
                        setStructureItems((items) => items.map((it, i) => (i === idx ? { ...it, percentOfBasic: e.target.value, amount: "" } : it)))
                      }
                    />
                  </div>
                  {structureItems.length > 1 ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => setStructureItems((items) => items.filter((_, i) => i !== idx))}>
                      Remove
                    </Button>
                  ) : null}
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setStructureItems((items) => [...items, { type: "EARNING", name: "", amount: "", percentOfBasic: "" }])}
              >
                Add line item
              </Button>
            </div>
            <Button type="submit" size="sm" disabled={!structureForm.name || !structureForm.basicSalary}>
              Create salary structure
            </Button>
          </form>

          <Separator />

          <div className="flex flex-wrap items-end gap-3">
            <p className="w-full text-sm font-medium">Assign to employee</p>
            <div className="space-y-1">
              <Label className="text-xs">Employee</Label>
              <NativeSelect
                className="w-56"
                placeholder="Select employee"
                value={assignEmployeeId}
                onChange={setAssignEmployeeId}
                options={(employees.data ?? []).map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName} (${e.employeeCode})` }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Salary structure</Label>
              <NativeSelect
                className="w-48"
                placeholder="Select structure"
                value={assignStructureId}
                onChange={setAssignStructureId}
                options={(structures.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
              />
            </div>
            <Button
              type="button"
              size="sm"
              disabled={!assignEmployeeId || !assignStructureId}
              onClick={() =>
                submitAction(() => api.assignSalaryStructure(assignEmployeeId, assignStructureId), () => {
                  setAssignEmployeeId("");
                  setAssignStructureId("");
                  employees.mutate();
                })
              }
            >
              Assign
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generate Payroll</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={async (e: FormEvent) => {
              e.preventDefault();
              const periodMonth = Number(generateForm.periodMonth);
              const periodYear = Number(generateForm.periodYear);
              try {
                const preview = await api.previewPayrollGeneration({ periodMonth, periodYear });
                setGeneratePreview({ periodMonth, periodYear, ...preview });
              } catch (err) {
                toast.error(errorMessage(err, "Could not compute how many employees this affects"));
              }
            }}
          >
            <div className="space-y-1">
              <Label className="text-xs">Month</Label>
              <NativeSelect
                className="w-36"
                placeholder="Select month"
                value={generateForm.periodMonth}
                onChange={(v) => setGenerateForm((f) => ({ ...f, periodMonth: v }))}
                options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Year</Label>
              <Input
                type="number"
                className="w-28"
                value={generateForm.periodYear}
                onChange={(e) => setGenerateForm((f) => ({ ...f, periodYear: e.target.value }))}
              />
            </div>
            <Button type="submit" size="sm" disabled={!generateForm.periodMonth || !generateForm.periodYear}>
              Generate for this period
            </Button>
          </form>
          {generateResult ? (
            <p className="text-muted-foreground text-xs">
              Generated {generateResult.generated.length}, skipped {generateResult.skipped.length}
              {generateResult.skipped.length > 0 ? ` (${generateResult.skipped.map((s) => employeeLabel(s.employeeId)).join(", ")})` : ""}.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payroll</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <NativeSelect
            className="w-40"
            placeholder="All"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as PayrollStatus | "")}
            options={STATUS_FILTERS}
          />
          {!payrolls.data || payrolls.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No payroll records.</p>
          ) : (
            <ul className="divide-y text-sm">
              {payrolls.data.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                  <button type="button" className="hover:text-primary text-left" onClick={() => setActivePayrollId(p.id)}>
                    {p.employee.firstName} {p.employee.lastName}{" "}
                    <span className="text-muted-foreground">
                      — {monthYearLabel(p.periodMonth, p.periodYear)} · net {formatMoney(p.netPay)}
                    </span>
                  </button>
                  <Badge variant={payrollStatusVariant(p.status)}>{p.status}</Badge>
                </li>
              ))}
            </ul>
          )}

          {activePayrollId && activePayroll.data
            ? (() => {
                const payroll = activePayroll.data;
                return (
                  <div className="bg-muted/40 space-y-3 rounded-lg border p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">
                        {payroll.employee.firstName} {payroll.employee.lastName} — {monthYearLabel(payroll.periodMonth, payroll.periodYear)}
                      </p>
                      <Badge variant={payrollStatusVariant(payroll.status)}>{payroll.status}</Badge>
                    </div>
                    <ul className="text-muted-foreground pl-4 text-xs">
                      {payroll.items.map((i) => (
                        <li key={i.id} className="flex items-center justify-between gap-2 py-0.5">
                          <span>
                            {i.name} ({i.type.toLowerCase()}): {i.type === "DEDUCTION" ? "-" : ""}
                            {formatMoney(i.amount)}
                          </span>
                          {payroll.status === "DRAFT" ? (
                            <button
                              type="button"
                              className="hover:text-destructive"
                              onClick={() =>
                                submitAction(() => api.removePayrollItem(activePayrollId, i.id), () => {
                                  activePayroll.mutate();
                                })
                              }
                            >
                              Remove
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    {payroll.grossPay != null ? (
                      <p className="text-xs">
                        Gross {formatMoney(payroll.grossPay)} − deductions {formatMoney(payroll.totalDeductions)} = net{" "}
                        <span className="font-medium">{formatMoney(payroll.netPay)}</span>
                      </p>
                    ) : null}

                    {payroll.status === "DRAFT" ? (
                      <form
                        className="flex flex-wrap items-end gap-2"
                        onSubmit={(e: FormEvent) => {
                          e.preventDefault();
                          submitAction(
                            () => api.addPayrollItem(activePayrollId, { type: itemForm.type, name: itemForm.name, amount: Number(itemForm.amount) }),
                            () => {
                              setItemForm({ type: "EARNING", name: "", amount: "" });
                              activePayroll.mutate();
                            },
                          );
                        }}
                      >
                        <NativeSelect
                          className="h-8 w-32"
                          placeholder="Type"
                          value={itemForm.type}
                          onChange={(v) => setItemForm((f) => ({ ...f, type: v as PayrollItemType }))}
                          options={ITEM_TYPES}
                        />
                        <Input
                          className="h-8 w-36"
                          placeholder="Item name"
                          value={itemForm.name}
                          onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
                        />
                        <Input
                          type="number"
                          className="h-8 w-24"
                          placeholder="Amount"
                          value={itemForm.amount}
                          onChange={(e) => setItemForm((f) => ({ ...f, amount: e.target.value }))}
                        />
                        <Button type="submit" size="sm" className="h-8" disabled={!itemForm.name || !itemForm.amount}>
                          Add item
                        </Button>
                      </form>
                    ) : null}

                    <div className="flex flex-wrap gap-2 pt-2">
                      {payroll.status === "DRAFT" ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            submitAction(() => api.finalizePayroll(activePayrollId), () => {
                              activePayroll.mutate();
                              payrolls.mutate();
                            })
                          }
                        >
                          Finalize
                        </Button>
                      ) : null}
                      {payroll.status === "FINALIZED" ? (
                        <div className="flex items-end gap-2">
                          <NativeSelect
                            className="h-8 w-40"
                            placeholder="Payment method"
                            value={payForm}
                            onChange={(v) => setPayForm(v as PaymentMethod)}
                            options={PAYMENT_METHODS}
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="h-8"
                            onClick={() =>
                              submitAction(() => api.markPayrollPaid(activePayrollId, { paymentMethod: payForm }), () => {
                                activePayroll.mutate();
                                payrolls.mutate();
                              })
                            }
                          >
                            Mark paid
                          </Button>
                        </div>
                      ) : null}
                      {payroll.status === "DRAFT" || payroll.status === "FINALIZED" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (payroll.status === "FINALIZED") {
                              setConfirmingCancelFinalized(true);
                              return;
                            }
                            submitAction(() => api.cancelPayroll(activePayrollId), () => {
                              activePayroll.mutate();
                              payrolls.mutate();
                            });
                          }}
                        >
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })()
            : null}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={generatePreview !== null}
        onOpenChange={(open) => !open && setGeneratePreview(null)}
        title={`Generate payroll for ${generatePreview ? monthYearLabel(generatePreview.periodMonth, generatePreview.periodYear) : "this period"}?`}
        description={
          generatePreview
            ? generatePreview.eligibleCount === 0
              ? "Every active, salary-assigned employee already has a payroll run for this period — nothing new will be generated."
              : `This creates ${generatePreview.eligibleCount} new payroll run(s), roughly ${formatMoney(generatePreview.grossTotal)} gross before any unpaid-leave deduction${
                  generatePreview.alreadyGeneratedCount > 0
                    ? ` (${generatePreview.alreadyGeneratedCount} employee(s) already generated, skipped)`
                    : ""
                }.`
            : ""
        }
        confirmLabel="Generate payroll"
        onConfirm={async () => {
          if (!generatePreview) return;
          try {
            const result = await api.generatePayroll({
              periodMonth: generatePreview.periodMonth,
              periodYear: generatePreview.periodYear,
            });
            setGenerateResult(result);
            payrolls.mutate();
            toast.success("Generated");
          } catch (err) {
            toast.error(errorMessage(err, "Failed"));
          }
        }}
      />

      <ConfirmDialog
        open={confirmingCancelFinalized}
        onOpenChange={setConfirmingCancelFinalized}
        title="Cancel this finalized payroll run?"
        description="Its computed totals were already frozen at finalize time. Cancelling voids the run — it cannot be un-cancelled, only regenerated from scratch."
        confirmLabel="Cancel run"
        variant="destructive"
        onConfirm={() => {
          if (!activePayrollId) return;
          return submitAction(() => api.cancelPayroll(activePayrollId), () => {
            activePayroll.mutate();
            payrolls.mutate();
          });
        }}
      />
    </div>
    </FeatureLock>
  );
}
