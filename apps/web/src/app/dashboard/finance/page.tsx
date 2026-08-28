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
import { EntityCard } from "@/components/dashboard/entity-card";
import { ListPager } from "@/components/dashboard/list-pager";
import { api } from "@/lib/api";
import { statusVariant } from "@/lib/status-variant";
import { submitEsewaForm } from "@/lib/esewa";
import { submitAction, submitDelete, errorMessage } from "@/lib/submit-action";
import type { PaymentMethod, StudentEnrollment } from "@education-erp/api-client";

function formatMoney(amount: string) {
  return `NPR ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CHEQUE", label: "Cheque" },
];

export default function FinancePage() {
  const feeCategories = useSWR("fee-categories", () => api.listFeeCategories());
  const feeStructures = useSWR("fee-structures", () => api.listFeeStructures());
  const scholarships = useSWR("scholarships", () => api.listScholarships());
  // Paginated (Phase 8 performance-optimization slice) — invoicesPage
  // is part of the SWR key so changing it triggers a fresh fetch of
  // that page, same pattern as the students/staff admin lists.
  const [invoicesPage, setInvoicesPage] = useState(1);
  const invoices = useSWR(["invoices", invoicesPage], () => api.listInvoices({ page: invoicesPage }));
  // Deliberately the unbounded, narrow picker — this is a "pick a
  // student" dropdown, not the paginated admin list view (Phase 8
  // performance-optimization slice).
  const students = useSWR("students-picker", () => api.listStudentsPicker());

  // ── Fee categories ──────────────────────────────────────────────────
  const [categoryForm, setCategoryForm] = useState({ name: "", code: "", description: "" });
  const [editingFeeCategoryId, setEditingFeeCategoryId] = useState<string | null>(null);
  const [editFeeCategoryForm, setEditFeeCategoryForm] = useState({ name: "", code: "", description: "" });

  // ── Fee structures ──────────────────────────────────────────────────
  const [structureForm, setStructureForm] = useState({ programId: "", termId: "", name: "" });
  const [structureItems, setStructureItems] = useState([{ feeCategoryId: "", amount: "" }]);
  const programs = useSWR("programs", () => api.listPrograms());
  const terms = useSWR("terms", () => api.listTerms());

  const [assignForm, setAssignForm] = useState<Record<string, { studentId: string; dueDate: string }>>({});
  const [bulkDueDate, setBulkDueDate] = useState<Record<string, string>>({});
  const [studentEnrollments, setStudentEnrollments] = useState<StudentEnrollment[]>([]);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState("");

  // ── Scholarships ─────────────────────────────────────────────────────
  const [scholarshipForm, setScholarshipForm] = useState({ name: "", percentage: "", amount: "" });
  const [scholarshipAssign, setScholarshipAssign] = useState({ studentId: "", scholarshipId: "" });
  const [editingScholarshipId, setEditingScholarshipId] = useState<string | null>(null);
  const [editScholarshipForm, setEditScholarshipForm] = useState({ name: "", percentage: "", amount: "" });

  // ── Invoices ─────────────────────────────────────────────────────────
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const activeInvoice = useSWR(
    activeInvoiceId ? ["invoice", activeInvoiceId] : null,
    () => api.getInvoice(activeInvoiceId as string),
  );
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "CASH" as PaymentMethod, reference: "" });
  const [discountForm, setDiscountForm] = useState({ amount: "", reason: "" });
  const [refundForm, setRefundForm] = useState<Record<string, { amount: string; reason: string }>>({});

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Finance</h1>
        <p className="text-muted-foreground text-sm">
          Fee structures, invoicing, manual payment recording (cash, bank transfer, cheque), and online
          payment via eSewa.
        </p>
      </div>

      <EntityCard
        title="Fee categories"
        emptyLabel="No fee categories yet."
        items={feeCategories.data}
        renderItem={(c: { id: string; name: string; code: string; description: string | null }) => (
          <div className="flex items-center justify-between gap-2">
            <span>
              {c.name} <span className="text-muted-foreground">({c.code})</span>
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingFeeCategoryId(c.id);
                  setEditFeeCategoryForm({ name: c.name, code: c.code, description: c.description ?? "" });
                }}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => submitDelete(() => api.deleteFeeCategory(c.id), () => feeCategories.mutate())}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
        footer={
          editingFeeCategoryId ? (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                submitAction(
                  () =>
                    api.updateFeeCategory(editingFeeCategoryId, {
                      name: editFeeCategoryForm.name,
                      code: editFeeCategoryForm.code,
                      description: editFeeCategoryForm.description || undefined,
                    }),
                  () => {
                    setEditingFeeCategoryId(null);
                    feeCategories.mutate();
                  },
                );
              }}
            >
              <div className="space-y-2">
                <Label className="text-xs">Name</Label>
                <Input
                  value={editFeeCategoryForm.name}
                  onChange={(e) => setEditFeeCategoryForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Code</Label>
                <Input
                  className="w-28"
                  value={editFeeCategoryForm.code}
                  onChange={(e) => setEditFeeCategoryForm((f) => ({ ...f, code: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Description</Label>
                <Input
                  value={editFeeCategoryForm.description}
                  onChange={(e) => setEditFeeCategoryForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <Button type="submit" size="sm">
                Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingFeeCategoryId(null)}>
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
                api.createFeeCategory({
                  name: categoryForm.name,
                  code: categoryForm.code,
                  description: categoryForm.description || undefined,
                }),
              () => {
                setCategoryForm({ name: "", code: "", description: "" });
                feeCategories.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label className="text-xs">Name</Label>
            <Input value={categoryForm.name} onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Code</Label>
            <Input
              className="w-28"
              value={categoryForm.code}
              onChange={(e) => setCategoryForm((f) => ({ ...f, code: e.target.value }))}
            />
          </div>
          <Button type="submit" size="sm" disabled={!categoryForm.name || !categoryForm.code}>
            Add category
          </Button>
        </form>
      </EntityCard>

      <Card>
        <CardHeader>
          <CardTitle>Fee structures</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!feeStructures.data || feeStructures.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No fee structures yet.</p>
          ) : (
            <ul className="divide-y">
              {feeStructures.data.map((s) => (
                <li key={s.id} className="space-y-2 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <strong>{s.name}</strong> — {s.program.name} · {s.term.name}
                    </span>
                    <span className="text-muted-foreground">
                      Total: {formatMoney(s.items.reduce((sum, i) => sum + Number(i.amount), 0).toFixed(2))}
                    </span>
                  </div>
                  <ul className="text-muted-foreground pl-4 text-xs">
                    {s.items.map((i) => (
                      <li key={i.id}>
                        {i.feeCategory.name}: {formatMoney(i.amount)}
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Due date</Label>
                      <Input
                        type="date"
                        className="h-8 w-36"
                        value={bulkDueDate[s.id] ?? ""}
                        onChange={(e) => setBulkDueDate((f) => ({ ...f, [s.id]: e.target.value }))}
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8"
                      disabled={!bulkDueDate[s.id]}
                      onClick={() =>
                        api.assignFeeStructureBulk(s.id, { dueDate: bulkDueDate[s.id] }).then(
                          (result) => {
                            invoices.mutate();
                            toast.success(
                              result.skipped.length === 0
                                ? `Invoice generated for ${result.assigned.length} student(s)`
                                : `Invoice generated for ${result.assigned.length} student(s) — ${result.skipped.length} already had one, skipped`,
                            );
                          },
                          (err) => toast.error(errorMessage(err, "Failed to generate invoices")),
                        )
                      }
                    >
                      Assign to all enrolled
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Student</Label>
                      <NativeSelect
                        className="h-8 w-48"
                        placeholder="Select student"
                        value={assignForm[s.id]?.studentId ?? ""}
                        onChange={(v) => {
                          setAssignForm((f) => ({ ...f, [s.id]: { studentId: v, dueDate: f[s.id]?.dueDate ?? "" } }));
                          setSelectedEnrollmentId("");
                          if (v) api.listEnrollments(v).then(setStudentEnrollments);
                        }}
                        options={(students.data ?? []).map((st) => ({
                          value: st.id,
                          label: `${st.firstName} ${st.lastName} (${st.studentCode})`,
                        }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Enrollment</Label>
                      <NativeSelect
                        className="h-8 w-40"
                        placeholder="Select term"
                        value={selectedEnrollmentId}
                        onChange={setSelectedEnrollmentId}
                        options={studentEnrollments
                          .filter((e) => e.programId === s.programId && e.termId === s.termId)
                          .map((e) => ({ value: e.id, label: e.term.name }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Due date</Label>
                      <Input
                        type="date"
                        className="h-8 w-36"
                        value={assignForm[s.id]?.dueDate ?? ""}
                        onChange={(e) =>
                          setAssignForm((f) => ({
                            ...f,
                            [s.id]: { studentId: f[s.id]?.studentId ?? "", dueDate: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      disabled={!selectedEnrollmentId || !assignForm[s.id]?.dueDate}
                      onClick={() =>
                        submitAction(
                          () =>
                            api.assignFeeStructure(s.id, {
                              studentEnrollmentId: selectedEnrollmentId,
                              dueDate: assignForm[s.id].dueDate,
                            }),
                          () => {
                            invoices.mutate();
                            setSelectedEnrollmentId("");
                          },
                        )
                      }
                    >
                      Assign to student
                    </Button>
                  </div>
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
                  api.createFeeStructure({
                    programId: structureForm.programId,
                    termId: structureForm.termId,
                    name: structureForm.name,
                    items: structureItems
                      .filter((i) => i.feeCategoryId && i.amount)
                      .map((i) => ({ feeCategoryId: i.feeCategoryId, amount: Number(i.amount) })),
                  }),
                () => {
                  setStructureForm({ programId: "", termId: "", name: "" });
                  setStructureItems([{ feeCategoryId: "", amount: "" }]);
                  feeStructures.mutate();
                },
              );
            }}
          >
            <p className="text-sm font-medium">New fee structure</p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Program</Label>
                <NativeSelect
                  className="w-48"
                  placeholder="Select program"
                  value={structureForm.programId}
                  onChange={(v) => setStructureForm((f) => ({ ...f, programId: v }))}
                  options={(programs.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Term</Label>
                <NativeSelect
                  className="w-40"
                  placeholder="Select term"
                  value={structureForm.termId}
                  onChange={(v) => setStructureForm((f) => ({ ...f, termId: v }))}
                  options={(terms.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={structureForm.name}
                  onChange={(e) => setStructureForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              {structureItems.map((item, idx) => (
                <div key={idx} className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Fee category</Label>
                    <NativeSelect
                      className="w-48"
                      placeholder="Select category"
                      value={item.feeCategoryId}
                      onChange={(v) =>
                        setStructureItems((items) =>
                          items.map((it, i) => (i === idx ? { ...it, feeCategoryId: v } : it)),
                        )
                      }
                      options={(feeCategories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Amount (NPR)</Label>
                    <Input
                      type="number"
                      className="w-32"
                      value={item.amount}
                      onChange={(e) =>
                        setStructureItems((items) =>
                          items.map((it, i) => (i === idx ? { ...it, amount: e.target.value } : it)),
                        )
                      }
                    />
                  </div>
                  {structureItems.length > 1 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setStructureItems((items) => items.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setStructureItems((items) => [...items, { feeCategoryId: "", amount: "" }])}
              >
                Add line item
              </Button>
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={!structureForm.programId || !structureForm.termId || !structureForm.name}
            >
              Create fee structure
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scholarships</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!scholarships.data || scholarships.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No scholarships yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {scholarships.data.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {s.name}{" "}
                    <span className="text-muted-foreground">
                      ({s.percentage != null ? `${s.percentage}%` : formatMoney(s.amount ?? "0")})
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingScholarshipId(s.id);
                        setEditScholarshipForm({
                          name: s.name,
                          percentage: s.percentage != null ? String(s.percentage) : "",
                          amount: s.amount != null ? String(s.amount) : "",
                        });
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => submitDelete(() => api.deleteScholarship(s.id), () => scholarships.mutate())}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {editingScholarshipId ? (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                submitAction(
                  () =>
                    api.updateScholarship(editingScholarshipId, {
                      name: editScholarshipForm.name,
                      percentage: editScholarshipForm.percentage ? Number(editScholarshipForm.percentage) : undefined,
                      amount: editScholarshipForm.amount ? Number(editScholarshipForm.amount) : undefined,
                    }),
                  () => {
                    setEditingScholarshipId(null);
                    scholarships.mutate();
                  },
                );
              }}
            >
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={editScholarshipForm.name}
                  onChange={(e) => setEditScholarshipForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Percentage</Label>
                <Input
                  type="number"
                  className="w-24"
                  value={editScholarshipForm.percentage}
                  onChange={(e) => setEditScholarshipForm((f) => ({ ...f, percentage: e.target.value, amount: "" }))}
                />
              </div>
              <span className="text-muted-foreground pb-2 text-xs">or</span>
              <div className="space-y-1">
                <Label className="text-xs">Fixed amount (NPR)</Label>
                <Input
                  type="number"
                  className="w-32"
                  value={editScholarshipForm.amount}
                  onChange={(e) => setEditScholarshipForm((f) => ({ ...f, amount: e.target.value, percentage: "" }))}
                />
              </div>
              <Button type="submit" size="sm">
                Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingScholarshipId(null)}>
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
                  api.createScholarship({
                    name: scholarshipForm.name,
                    percentage: scholarshipForm.percentage ? Number(scholarshipForm.percentage) : undefined,
                    amount: scholarshipForm.amount ? Number(scholarshipForm.amount) : undefined,
                  }),
                () => {
                  setScholarshipForm({ name: "", percentage: "", amount: "" });
                  scholarships.mutate();
                },
              );
            }}
          >
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={scholarshipForm.name}
                onChange={(e) => setScholarshipForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Percentage</Label>
              <Input
                type="number"
                className="w-24"
                value={scholarshipForm.percentage}
                onChange={(e) => setScholarshipForm((f) => ({ ...f, percentage: e.target.value, amount: "" }))}
              />
            </div>
            <span className="text-muted-foreground pb-2 text-xs">or</span>
            <div className="space-y-1">
              <Label className="text-xs">Fixed amount (NPR)</Label>
              <Input
                type="number"
                className="w-32"
                value={scholarshipForm.amount}
                onChange={(e) => setScholarshipForm((f) => ({ ...f, amount: e.target.value, percentage: "" }))}
              />
            </div>
            <Button type="submit" size="sm" disabled={!scholarshipForm.name}>
              Add scholarship
            </Button>
          </form>
          <Separator />
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submitAction(
                () => api.assignScholarship(scholarshipAssign.studentId, { scholarshipId: scholarshipAssign.scholarshipId }),
                () => setScholarshipAssign({ studentId: "", scholarshipId: "" }),
              );
            }}
          >
            <div className="space-y-1">
              <Label className="text-xs">Student</Label>
              <NativeSelect
                className="w-48"
                placeholder="Select student"
                value={scholarshipAssign.studentId}
                onChange={(v) => setScholarshipAssign((f) => ({ ...f, studentId: v }))}
                options={(students.data ?? []).map((s) => ({
                  value: s.id,
                  label: `${s.firstName} ${s.lastName} (${s.studentCode})`,
                }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Scholarship</Label>
              <NativeSelect
                className="w-48"
                placeholder="Select scholarship"
                value={scholarshipAssign.scholarshipId}
                onChange={(v) => setScholarshipAssign((f) => ({ ...f, scholarshipId: v }))}
                options={(scholarships.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
              />
            </div>
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={!scholarshipAssign.studentId || !scholarshipAssign.scholarshipId}
            >
              Assign to student
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!invoices.data || invoices.data.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No invoices yet.</p>
          ) : (
            <>
              <ul className="divide-y text-sm">
                {invoices.data.data.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-2 py-2">
                    <button type="button" className="hover:text-primary text-left" onClick={() => setActiveInvoiceId(inv.id)}>
                      {inv.student.firstName} {inv.student.lastName}{" "}
                      <span className="text-muted-foreground">
                        — {formatMoney(inv.totalAmount)} · due {new Date(inv.dueDate).toLocaleDateString()}
                      </span>
                    </button>
                    <Badge variant={statusVariant(inv.status)}>{inv.status}</Badge>
                  </li>
                ))}
              </ul>
              <ListPager
                page={invoices.data.page}
                totalPages={invoices.data.totalPages}
                onPrev={() => setInvoicesPage((p) => Math.max(1, p - 1))}
                onNext={() => setInvoicesPage((p) => p + 1)}
              />
            </>
          )}

          {activeInvoiceId && activeInvoice.data ? (
            <div className="bg-muted/40 space-y-3 rounded-lg border p-4 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium">
                  {activeInvoice.data.student.firstName} {activeInvoice.data.student.lastName} —{" "}
                  {formatMoney(activeInvoice.data.totalAmount)}
                </p>
                <Badge variant={statusVariant(activeInvoice.data.status)}>{activeInvoice.data.status}</Badge>
              </div>
              <ul className="text-muted-foreground pl-4 text-xs">
                {activeInvoice.data.items.map((i) => (
                  <li key={i.id}>
                    {i.feeCategory.name}: {formatMoney(i.amount)}
                  </li>
                ))}
              </ul>
              {activeInvoice.data.discounts.length > 0 ? (
                <ul className="text-xs text-emerald-700">
                  {activeInvoice.data.discounts.map((d) => (
                    <li key={d.id}>
                      Discount — {d.reason}: -{formatMoney(d.amount)}
                    </li>
                  ))}
                </ul>
              ) : null}
              {activeInvoice.data.payments.length > 0 ? (
                <ul className="space-y-1 text-xs">
                  {activeInvoice.data.payments.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-2">
                      <span>
                        Paid {formatMoney(p.amount)} via {p.method} on {new Date(p.paidAt).toLocaleDateString()}
                      </span>
                      <Input
                        type="number"
                        className="h-6 w-20"
                        placeholder="Amount"
                        value={refundForm[p.id]?.amount ?? ""}
                        onChange={(e) =>
                          setRefundForm((f) => ({ ...f, [p.id]: { ...f[p.id], amount: e.target.value, reason: f[p.id]?.reason ?? "" } }))
                        }
                      />
                      <Input
                        className="h-6 w-32"
                        placeholder="Reason"
                        value={refundForm[p.id]?.reason ?? ""}
                        onChange={(e) =>
                          setRefundForm((f) => ({ ...f, [p.id]: { ...f[p.id], reason: e.target.value, amount: f[p.id]?.amount ?? "" } }))
                        }
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6"
                        disabled={!refundForm[p.id]?.amount || !refundForm[p.id]?.reason}
                        onClick={() =>
                          submitAction(
                            () =>
                              api.issueRefund(p.id, {
                                amount: Number(refundForm[p.id].amount),
                                reason: refundForm[p.id].reason,
                              }),
                            () => {
                              activeInvoice.mutate();
                              invoices.mutate();
                              setRefundForm((f) => ({ ...f, [p.id]: { amount: "", reason: "" } }));
                            },
                          )
                        }
                      >
                        Refund
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {activeInvoice.data.status !== "CANCELLED" ? (
                <div className="flex flex-wrap gap-4 pt-2">
                  <form
                    className="flex flex-wrap items-end gap-2"
                    onSubmit={(e: FormEvent) => {
                      e.preventDefault();
                      submitAction(
                        () =>
                          api.recordPayment(activeInvoiceId, {
                            amount: Number(paymentForm.amount),
                            method: paymentForm.method,
                            reference: paymentForm.reference || undefined,
                          }),
                        () => {
                          setPaymentForm({ amount: "", method: "CASH", reference: "" });
                          activeInvoice.mutate();
                          invoices.mutate();
                        },
                      );
                    }}
                  >
                    <div className="space-y-1">
                      <Label className="text-xs">Payment amount</Label>
                      <Input
                        type="number"
                        className="h-8 w-28"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Method</Label>
                      <NativeSelect
                        className="h-8 w-36"
                        placeholder="Select method"
                        value={paymentForm.method}
                        onChange={(v) => setPaymentForm((f) => ({ ...f, method: v as PaymentMethod }))}
                        options={PAYMENT_METHODS}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Reference (optional)</Label>
                      <Input
                        className="h-8 w-32"
                        value={paymentForm.reference}
                        onChange={(e) => setPaymentForm((f) => ({ ...f, reference: e.target.value }))}
                      />
                    </div>
                    <Button type="submit" size="sm" className="h-8" disabled={!paymentForm.amount}>
                      Record payment
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      disabled={!paymentForm.amount}
                      onClick={async () => {
                        try {
                          const { actionUrl, fields } = await api.initiateEsewaPayment(activeInvoiceId, {
                            amount: Number(paymentForm.amount),
                          });
                          submitEsewaForm(actionUrl, fields);
                        } catch (err) {
                          toast.error(errorMessage(err, "Could not start the eSewa payment"));
                        }
                      }}
                    >
                      Pay with eSewa
                    </Button>
                  </form>

                  <form
                    className="flex flex-wrap items-end gap-2"
                    onSubmit={(e: FormEvent) => {
                      e.preventDefault();
                      submitAction(
                        () =>
                          api.applyDiscount(activeInvoiceId, {
                            amount: Number(discountForm.amount),
                            reason: discountForm.reason,
                          }),
                        () => {
                          setDiscountForm({ amount: "", reason: "" });
                          activeInvoice.mutate();
                          invoices.mutate();
                        },
                      );
                    }}
                  >
                    <div className="space-y-1">
                      <Label className="text-xs">Discount amount</Label>
                      <Input
                        type="number"
                        className="h-8 w-28"
                        value={discountForm.amount}
                        onChange={(e) => setDiscountForm((f) => ({ ...f, amount: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Reason</Label>
                      <Input
                        className="h-8 w-40"
                        value={discountForm.reason}
                        onChange={(e) => setDiscountForm((f) => ({ ...f, reason: e.target.value }))}
                      />
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      disabled={!discountForm.amount || !discountForm.reason}
                    >
                      Apply discount
                    </Button>
                  </form>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
