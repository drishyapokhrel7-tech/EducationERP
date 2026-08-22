"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";

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
    toast.error(errorMessage(err, "Failed — check that required fields are filled in"));
  }
}

export default function BiometricPolicyPage() {
  const policy = useSWR("biometric-policy", () => api.getBiometricPolicy());
  const enrollments = useSWR("face-enrollments", () => api.listFaceEnrollments());
  const students = useSWR("students-for-biometric", () => api.listStudents());
  const staff = useSWR("staff-for-biometric", () => api.listEmployees());

  const [policyForm, setPolicyForm] = useState({
    enabled: false,
    retentionDays: "365",
    matchConfidenceThreshold: "0.75",
  });
  const [policySeeded, setPolicySeeded] = useState(false);
  if (policy.data && !policySeeded) {
    setPolicySeeded(true);
    setPolicyForm({
      enabled: policy.data.enabled,
      retentionDays: String(policy.data.retentionDays),
      matchConfidenceThreshold: String(policy.data.matchConfidenceThreshold),
    });
  }

  const [enrollForm, setEnrollForm] = useState({ personKey: "", consentGivenBy: "" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Biometric Policy</h1>
        <p className="text-muted-foreground text-sm">
          Phase 6 foundation — no face capture or matching exists yet. This is the org-wide enable switch and
          per-person consent record that has to exist before any of that is built.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization policy</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-4"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submitAction(
                () =>
                  api.updateBiometricPolicy({
                    enabled: policyForm.enabled,
                    retentionDays: Number(policyForm.retentionDays),
                    matchConfidenceThreshold: Number(policyForm.matchConfidenceThreshold),
                  }),
                () => policy.mutate(),
              );
            }}
          >
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={policyForm.enabled}
                onChange={(e) => setPolicyForm((f) => ({ ...f, enabled: e.target.checked }))}
              />
              Biometric attendance enabled
            </label>
            <div className="space-y-2">
              <Label className="text-xs">Retention (days)</Label>
              <Input
                type="number"
                className="w-28"
                value={policyForm.retentionDays}
                onChange={(e) => setPolicyForm((f) => ({ ...f, retentionDays: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Match confidence threshold</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="1"
                className="w-28"
                value={policyForm.matchConfidenceThreshold}
                onChange={(e) => setPolicyForm((f) => ({ ...f, matchConfidenceThreshold: e.target.value }))}
              />
            </div>
            <Button type="submit" size="sm">
              Save policy
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consent enrollments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!enrollments.data || enrollments.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No consent recorded yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {enrollments.data.map((e) => (
                <li key={e.id} className="flex items-center justify-between">
                  <span>
                    {e.student ? `${e.student.firstName} ${e.student.lastName} (student)` : null}
                    {e.staff ? `${e.staff.firstName} ${e.staff.lastName} (staff)` : null}
                    {` — consented by ${e.consentGivenBy} on ${new Date(e.consentGivenAt).toLocaleDateString()}`}
                    {e.status === "WITHDRAWN" ? " — withdrawn" : ""}
                  </span>
                  {e.status === "ACTIVE" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        submitAction(
                          () => api.withdrawFaceEnrollment(e.id),
                          () => enrollments.mutate(),
                        )
                      }
                    >
                      Withdraw
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <Separator />

          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              const [kind, id] = enrollForm.personKey.split(":");
              submitAction(
                () =>
                  api.createFaceEnrollment({
                    studentId: kind === "student" ? id : undefined,
                    staffId: kind === "staff" ? id : undefined,
                    consentGivenBy: enrollForm.consentGivenBy,
                  }),
                () => {
                  setEnrollForm({ personKey: "", consentGivenBy: "" });
                  enrollments.mutate();
                },
              );
            }}
          >
            <div className="space-y-2">
              <Label className="text-xs">Student or staff</Label>
              <NativeSelect
                className="w-56"
                placeholder="Select person"
                value={enrollForm.personKey}
                onChange={(v) => setEnrollForm((f) => ({ ...f, personKey: v }))}
                options={[
                  ...(students.data ?? []).map((s) => ({
                    value: `student:${s.id}`,
                    label: `${s.firstName} ${s.lastName} (student)`,
                  })),
                  ...(staff.data ?? []).map((s) => ({
                    value: `staff:${s.id}`,
                    label: `${s.firstName} ${s.lastName} (staff)`,
                  })),
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Consent given by</Label>
              <Input
                placeholder="e.g. self, or guardian's name"
                value={enrollForm.consentGivenBy}
                onChange={(e) => setEnrollForm((f) => ({ ...f, consentGivenBy: e.target.value }))}
              />
            </div>
            <Button type="submit" size="sm" disabled={!enrollForm.personKey || !enrollForm.consentGivenBy}>
              Record consent
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
