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
import { api } from "@/lib/api";
import { statusVariant } from "@/lib/status-variant";
import type { LeaveRequestStatus } from "@education-erp/api-client";

function errorMessage(err: unknown, fallback: string) {
  const message =
    err && typeof err === "object" && "body" in err
      ? ((err as { body?: { message?: string } }).body?.message ?? null)
      : null;
  return typeof message === "string" ? message : fallback;
}

async function submitAction(action: () => Promise<unknown>, onSuccess: () => void) {
  try {
    await action();
    onSuccess();
    toast.success("Saved");
  } catch (err) {
    toast.error(errorMessage(err, "Failed"));
  }
}

const STATUS_FILTERS: { value: LeaveRequestStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function LeavePage() {
  // Deliberately the unbounded, narrow picker — this is a "pick a
  // staff member" dropdown, not the paginated admin list view (Phase 8
  // performance-optimization slice).
  const employees = useSWR("employees-picker", () => api.listEmployeesPicker());
  const leaveTypes = useSWR("leave-types", () => api.listLeaveTypes());

  // ── Leave types ────────────────────────────────────────────────────
  const [typeForm, setTypeForm] = useState({ name: "", code: "", defaultDaysPerYear: "" });
  const [editingLeaveTypeId, setEditingLeaveTypeId] = useState<string | null>(null);
  const [editTypeForm, setEditTypeForm] = useState({
    name: "",
    code: "",
    defaultDaysPerYear: "",
    isPaid: true,
    carryForward: false,
  });

  // ── Balances ───────────────────────────────────────────────────────
  const [balanceEmployeeId, setBalanceEmployeeId] = useState("");
  const balances = useSWR(balanceEmployeeId ? ["leave-balances", balanceEmployeeId] : null, () =>
    api.listEmployeeLeaveBalances(balanceEmployeeId),
  );
  const [allocateForm, setAllocateForm] = useState({ leaveTypeId: "", year: String(new Date().getFullYear()), allocatedDays: "" });

  // ── Requests ───────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<LeaveRequestStatus | "">("");
  const requests = useSWR(["leave-requests", statusFilter], () =>
    api.listLeaveRequests(statusFilter ? { status: statusFilter } : {}),
  );
  const [requestForm, setRequestForm] = useState({ employeeId: "", leaveTypeId: "", startDate: "", endDate: "", reason: "" });

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Leave</h1>
        <p className="text-muted-foreground text-sm">
          Leave types, balances, and requests for staff. Payroll is a separate, upcoming slice.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leave Types</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!leaveTypes.data || leaveTypes.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No leave types yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {leaveTypes.data.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {t.name} <span className="text-muted-foreground">({t.code}) — {t.defaultDaysPerYear} days/year{t.isPaid ? "" : " · unpaid"}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingLeaveTypeId(t.id);
                        setEditTypeForm({
                          name: t.name,
                          code: t.code,
                          defaultDaysPerYear: String(t.defaultDaysPerYear),
                          isPaid: t.isPaid,
                          carryForward: t.carryForward,
                        });
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => submitAction(() => api.deleteLeaveType(t.id), () => leaveTypes.mutate())}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {editingLeaveTypeId ? (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                submitAction(
                  () =>
                    api.updateLeaveType(editingLeaveTypeId, {
                      name: editTypeForm.name,
                      code: editTypeForm.code,
                      defaultDaysPerYear: Number(editTypeForm.defaultDaysPerYear),
                      isPaid: editTypeForm.isPaid,
                      carryForward: editTypeForm.carryForward,
                    }),
                  () => {
                    setEditingLeaveTypeId(null);
                    leaveTypes.mutate();
                  },
                );
              }}
            >
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={editTypeForm.name} onChange={(e) => setEditTypeForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Code</Label>
                <Input className="w-28" value={editTypeForm.code} onChange={(e) => setEditTypeForm((f) => ({ ...f, code: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Default days/year</Label>
                <Input
                  type="number"
                  className="w-32"
                  value={editTypeForm.defaultDaysPerYear}
                  onChange={(e) => setEditTypeForm((f) => ({ ...f, defaultDaysPerYear: e.target.value }))}
                />
              </div>
              <label className="flex items-center gap-1 pb-2 text-xs">
                <input
                  type="checkbox"
                  checked={editTypeForm.isPaid}
                  onChange={(e) => setEditTypeForm((f) => ({ ...f, isPaid: e.target.checked }))}
                />
                Paid
              </label>
              <label className="flex items-center gap-1 pb-2 text-xs">
                <input
                  type="checkbox"
                  checked={editTypeForm.carryForward}
                  onChange={(e) => setEditTypeForm((f) => ({ ...f, carryForward: e.target.checked }))}
                />
                Carry forward
              </label>
              <Button type="submit" size="sm" disabled={!editTypeForm.name || !editTypeForm.code || !editTypeForm.defaultDaysPerYear}>
                Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingLeaveTypeId(null)}>
                Cancel
              </Button>
            </form>
          ) : null}
          <Separator />
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submitAction(
                () =>
                  api.createLeaveType({
                    name: typeForm.name,
                    code: typeForm.code,
                    defaultDaysPerYear: Number(typeForm.defaultDaysPerYear),
                  }),
                () => {
                  setTypeForm({ name: "", code: "", defaultDaysPerYear: "" });
                  leaveTypes.mutate();
                },
              );
            }}
          >
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input value={typeForm.name} onChange={(e) => setTypeForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Code</Label>
              <Input className="w-28" value={typeForm.code} onChange={(e) => setTypeForm((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Default days/year</Label>
              <Input
                type="number"
                className="w-32"
                value={typeForm.defaultDaysPerYear}
                onChange={(e) => setTypeForm((f) => ({ ...f, defaultDaysPerYear: e.target.value }))}
              />
            </div>
            <Button type="submit" size="sm" disabled={!typeForm.name || !typeForm.code || !typeForm.defaultDaysPerYear}>
              Add leave type
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Balances</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <NativeSelect
            className="w-56"
            placeholder="Select employee"
            value={balanceEmployeeId}
            onChange={setBalanceEmployeeId}
            options={(employees.data ?? []).map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName} (${e.employeeCode})` }))}
          />
          {balanceEmployeeId ? (
            <>
              {!balances.data || balances.data.length === 0 ? (
                <p className="text-muted-foreground text-sm">No allocations yet for this employee.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {balances.data.map((b) => (
                    <li key={b.id} className="py-2">
                      {b.leaveType.name} ({b.year}): {b.usedDays}/{b.allocatedDays} used
                      <span className="text-muted-foreground"> — {b.remainingDays} remaining</span>
                    </li>
                  ))}
                </ul>
              )}
              <Separator />
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  submitAction(
                    () =>
                      api.allocateLeaveBalance({
                        employeeId: balanceEmployeeId,
                        leaveTypeId: allocateForm.leaveTypeId,
                        year: Number(allocateForm.year),
                        allocatedDays: Number(allocateForm.allocatedDays),
                      }),
                    () => {
                      setAllocateForm({ leaveTypeId: "", year: String(new Date().getFullYear()), allocatedDays: "" });
                      balances.mutate();
                    },
                  );
                }}
              >
                <div className="space-y-1">
                  <Label className="text-xs">Leave type</Label>
                  <NativeSelect
                    className="w-48"
                    placeholder="Select type"
                    value={allocateForm.leaveTypeId}
                    onChange={(v) => setAllocateForm((f) => ({ ...f, leaveTypeId: v }))}
                    options={(leaveTypes.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Year</Label>
                  <Input
                    type="number"
                    className="w-24"
                    value={allocateForm.year}
                    onChange={(e) => setAllocateForm((f) => ({ ...f, year: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Days</Label>
                  <Input
                    type="number"
                    className="w-24"
                    value={allocateForm.allocatedDays}
                    onChange={(e) => setAllocateForm((f) => ({ ...f, allocatedDays: e.target.value }))}
                  />
                </div>
                <Button type="submit" size="sm" disabled={!allocateForm.leaveTypeId || !allocateForm.allocatedDays}>
                  Allocate
                </Button>
              </form>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <NativeSelect
            className="w-40"
            placeholder="All"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as LeaveRequestStatus | "")}
            options={STATUS_FILTERS.filter((s) => s.value).map((s) => ({ value: s.value, label: s.label }))}
          />
          {!requests.data || requests.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No requests.</p>
          ) : (
            <ul className="divide-y text-sm">
              {requests.data.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {r.employee.firstName} {r.employee.lastName} — {r.leaveType.name} · {r.days} day(s) (
                    {new Date(r.startDate).toLocaleDateString()}–{new Date(r.endDate).toLocaleDateString()})
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                    {r.status === "PENDING" ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            submitAction(() => api.approveLeaveRequest(r.id), () => {
                              requests.mutate();
                              // Approving changes computed usedDays/remainingDays —
                              // the balances panel needs to refresh too, not just
                              // this list (same class of bug as the RBAC audit
                              // log panel: a useSWR hook whose data is a side
                              // effect of another action, not just its own CRUD).
                              balances.mutate();
                            })
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => submitAction(() => api.rejectLeaveRequest(r.id), () => requests.mutate())}
                        >
                          Reject
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => submitAction(() => api.cancelLeaveRequest(r.id), () => requests.mutate())}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Separator />
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submitAction(
                () =>
                  api.createLeaveRequest({
                    employeeId: requestForm.employeeId,
                    leaveTypeId: requestForm.leaveTypeId,
                    startDate: requestForm.startDate,
                    endDate: requestForm.endDate,
                    reason: requestForm.reason || undefined,
                  }),
                () => {
                  setRequestForm({ employeeId: "", leaveTypeId: "", startDate: "", endDate: "", reason: "" });
                  requests.mutate();
                },
              );
            }}
          >
            <div className="space-y-1">
              <Label className="text-xs">Employee</Label>
              <NativeSelect
                className="w-48"
                placeholder="Select employee"
                value={requestForm.employeeId}
                onChange={(v) => setRequestForm((f) => ({ ...f, employeeId: v }))}
                options={(employees.data ?? []).map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName} (${e.employeeCode})` }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Leave type</Label>
              <NativeSelect
                className="w-40"
                placeholder="Select type"
                value={requestForm.leaveTypeId}
                onChange={(v) => setRequestForm((f) => ({ ...f, leaveTypeId: v }))}
                options={(leaveTypes.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Start date</Label>
              <Input
                type="date"
                className="w-36"
                value={requestForm.startDate}
                onChange={(e) => setRequestForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End date</Label>
              <Input
                type="date"
                className="w-36"
                value={requestForm.endDate}
                onChange={(e) => setRequestForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reason</Label>
              <Input className="w-48" value={requestForm.reason} onChange={(e) => setRequestForm((f) => ({ ...f, reason: e.target.value }))} />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={!requestForm.employeeId || !requestForm.leaveTypeId || !requestForm.startDate || !requestForm.endDate}
            >
              Submit request
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
