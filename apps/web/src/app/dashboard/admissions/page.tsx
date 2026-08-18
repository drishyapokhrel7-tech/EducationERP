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
import type { AdmissionStatus } from "@education-erp/api-client";

const REVIEW_STATUSES: AdmissionStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "INTERVIEW_SCHEDULED",
  "APPROVED",
  "REJECTED",
];

export default function AdmissionsPage() {
  const applications = useSWR("admission-applications", () => api.listAdmissionApplications());
  const programs = useSWR("programs", () => api.listPrograms());
  const sections = useSWR("sections", () => api.listSections());
  const terms = useSWR("terms", () => api.listTerms());

  const [form, setForm] = useState({
    programId: "",
    applicantFirstName: "",
    applicantLastName: "",
    dateOfBirth: "",
    guardianName: "",
    guardianPhone: "",
    appliedDate: "",
  });
  const [statusEdits, setStatusEdits] = useState<Record<string, AdmissionStatus>>({});
  const [enrollForms, setEnrollForms] = useState<
    Record<string, { studentCode: string; sectionId: string; termId: string; enrollmentDate: string }>
  >({});

  async function submit(action: () => Promise<unknown>, onSuccess: () => void) {
    try {
      await action();
      onSuccess();
      toast.success("Saved");
    } catch {
      toast.error("Failed — check that required fields are filled in");
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admissions</h1>
        <p className="text-muted-foreground text-sm">
          Review moves an application through Submitted → Under Review → Interview Scheduled →
          Approved/Rejected. Enrolling an approved application creates a real student record.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Applications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!applications.data || applications.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No applications yet.</p>
          ) : (
            <ul className="space-y-4 divide-y">
              {applications.data.map((app) => {
                const enrollForm = enrollForms[app.id] ?? {
                  studentCode: "",
                  sectionId: "",
                  termId: "",
                  enrollmentDate: "",
                };
                return (
                  <li key={app.id} className="space-y-2 pt-4 first:pt-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm">
                        {app.applicantFirstName} {app.applicantLastName}{" "}
                        <span className="text-muted-foreground">
                          · {app.program.name} · {app.status}
                          {app.score != null ? ` · score ${app.score}` : ""}
                        </span>
                      </span>
                    </div>

                    {app.status !== "ENROLLED" ? (
                      <form
                        className="flex flex-wrap items-end gap-2"
                        onSubmit={(e: FormEvent) => {
                          e.preventDefault();
                          const status = statusEdits[app.id] ?? app.status;
                          if (status === "ENROLLED") return;
                          submit(
                            () =>
                              api.updateAdmissionStatus(app.id, {
                                status,
                                effectiveDate: new Date().toISOString().slice(0, 10),
                              }),
                            () => applications.mutate(),
                          );
                        }}
                      >
                        <NativeSelect
                          className="w-40"
                          placeholder="Set status"
                          value={statusEdits[app.id] ?? app.status}
                          onChange={(v) =>
                            setStatusEdits((f) => ({ ...f, [app.id]: v as AdmissionStatus }))
                          }
                          options={REVIEW_STATUSES.map((s) => ({ value: s, label: s }))}
                        />
                        <Button type="submit" size="sm">
                          Update status
                        </Button>
                      </form>
                    ) : null}

                    {app.status === "APPROVED" ? (
                      <form
                        className="flex flex-wrap items-end gap-2"
                        onSubmit={(e: FormEvent) => {
                          e.preventDefault();
                          submit(
                            () => api.enrollApplication(app.id, enrollForm),
                            () => {
                              setEnrollForms((f) => ({ ...f, [app.id]: { studentCode: "", sectionId: "", termId: "", enrollmentDate: "" } }));
                              applications.mutate();
                            },
                          );
                        }}
                      >
                        <Input
                          required
                          placeholder="Student code"
                          className="w-28"
                          value={enrollForm.studentCode}
                          onChange={(e) =>
                            setEnrollForms((f) => ({
                              ...f,
                              [app.id]: { ...enrollForm, studentCode: e.target.value },
                            }))
                          }
                        />
                        <NativeSelect
                          className="w-32"
                          placeholder="Section"
                          value={enrollForm.sectionId}
                          onChange={(v) =>
                            setEnrollForms((f) => ({ ...f, [app.id]: { ...enrollForm, sectionId: v } }))
                          }
                          options={(sections.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
                        />
                        <NativeSelect
                          className="w-32"
                          placeholder="Term"
                          value={enrollForm.termId}
                          onChange={(v) =>
                            setEnrollForms((f) => ({ ...f, [app.id]: { ...enrollForm, termId: v } }))
                          }
                          options={(terms.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
                        />
                        <Input
                          required
                          type="date"
                          value={enrollForm.enrollmentDate}
                          onChange={(e) =>
                            setEnrollForms((f) => ({
                              ...f,
                              [app.id]: { ...enrollForm, enrollmentDate: e.target.value },
                            }))
                          }
                        />
                        <Button
                          type="submit"
                          size="sm"
                          disabled={!enrollForm.studentCode || !enrollForm.sectionId || !enrollForm.termId}
                        >
                          Enroll
                        </Button>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          <Separator />

          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submit(
                () =>
                  api.createAdmissionApplication({
                    ...form,
                    guardianName: form.guardianName || undefined,
                    guardianPhone: form.guardianPhone || undefined,
                  }),
                () => {
                  setForm({
                    programId: "",
                    applicantFirstName: "",
                    applicantLastName: "",
                    dateOfBirth: "",
                    guardianName: "",
                    guardianPhone: "",
                    appliedDate: "",
                  });
                  applications.mutate();
                },
              );
            }}
          >
            <div className="space-y-2">
              <Label>Program</Label>
              <NativeSelect
                className="w-40"
                placeholder="Select program"
                value={form.programId}
                onChange={(v) => setForm((f) => ({ ...f, programId: v }))}
                options={(programs.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
              />
            </div>
            <div className="space-y-2">
              <Label>First name</Label>
              <Input
                required
                value={form.applicantFirstName}
                onChange={(e) => setForm((f) => ({ ...f, applicantFirstName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Last name</Label>
              <Input
                required
                value={form.applicantLastName}
                onChange={(e) => setForm((f) => ({ ...f, applicantLastName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Date of birth</Label>
              <Input
                required
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Guardian name (optional)</Label>
              <Input
                value={form.guardianName}
                onChange={(e) => setForm((f) => ({ ...f, guardianName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Guardian phone (optional)</Label>
              <Input
                value={form.guardianPhone}
                onChange={(e) => setForm((f) => ({ ...f, guardianPhone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Applied date</Label>
              <Input
                required
                type="date"
                value={form.appliedDate}
                onChange={(e) => setForm((f) => ({ ...f, appliedDate: e.target.value }))}
              />
            </div>
            <Button type="submit" disabled={!form.programId}>
              Submit application
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
