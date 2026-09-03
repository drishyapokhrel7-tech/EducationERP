"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { FeatureLock } from "@/components/feature-lock";
import { api } from "@/lib/api";
import { statusVariant } from "@/lib/status-variant";

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

// Every document/certificate here needs a real, already-uploaded
// fileUrl — this reuses the existing generic uploads endpoint
// (LMS discovery slice 8) exactly like every other file-attached
// feature in this project, not a new upload mechanism.
async function uploadFile(file: File): Promise<string> {
  const uploaded = await api.uploadFile(file);
  return uploaded.url;
}

export default function DocumentsPage() {
  // Deliberately the unbounded, narrow picker — this is a "pick a
  // student" dropdown, not the paginated admin list view (Phase 8
  // performance-optimization slice).
  const students = useSWR("students-picker", () => api.listStudentsPicker());
  // Deliberately the unbounded, narrow picker — this is a "pick a
  // staff member" dropdown, not the paginated admin list view (Phase 8
  // performance-optimization slice).
  const employees = useSWR("employees-picker", () => api.listEmployeesPicker());
  const studentDocuments = useSWR("student-documents", () => api.listStudentDocuments());
  const staffDocuments = useSWR("staff-documents", () => api.listStaffDocuments());
  const certificates = useSWR("certificates", () => api.listCertificates());

  const [studentDocForm, setStudentDocForm] = useState({ studentId: "", documentType: "" });
  const [studentDocFile, setStudentDocFile] = useState<File | null>(null);
  const [staffDocForm, setStaffDocForm] = useState({ employeeId: "", documentType: "" });
  const [staffDocFile, setStaffDocFile] = useState<File | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [certificateForm, setCertificateForm] = useState({ studentId: "", type: "" });
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [revokeReason, setRevokeReason] = useState<Record<string, string>>({});

  return (
    <FeatureLock feature="documents">
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Documents &amp; Certificates</h1>
        <p className="text-muted-foreground text-sm">
          Student and staff document uploads with a review workflow, plus institution-issued certificates with a public,
          code-based verification page anyone can check at /verify — no login needed.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!studentDocuments.data || studentDocuments.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No student documents yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {studentDocuments.data.map((d) => (
                <li key={d.id} className="rounded-md border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      <span className="font-medium">{d.documentType}</span>
                      {d.student ? (
                        <span className="text-muted-foreground">
                          {" "}
                          — {d.student.firstName} {d.student.lastName}
                        </span>
                      ) : null}{" "}
                      <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                        view
                      </a>
                    </span>
                    <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
                  </div>
                  {d.status === "PENDING" ? (
                    <div className="mt-2 flex flex-wrap items-end gap-2">
                      <Input
                        className="h-7 w-48"
                        placeholder="Notes (optional)"
                        value={reviewNotes[d.id] ?? ""}
                        onChange={(e) => setReviewNotes((m) => ({ ...m, [d.id]: e.target.value }))}
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-7"
                        onClick={() =>
                          submitAction(
                            () => api.reviewStudentDocument(d.id, { status: "VERIFIED", reviewNotes: reviewNotes[d.id] || undefined }),
                            () => studentDocuments.mutate(),
                          )
                        }
                      >
                        Verify
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() =>
                          submitAction(
                            () => api.reviewStudentDocument(d.id, { status: "REJECTED", reviewNotes: reviewNotes[d.id] || undefined }),
                            () => studentDocuments.mutate(),
                          )
                        }
                      >
                        Reject
                      </Button>
                    </div>
                  ) : d.reviewNotes ? (
                    <p className="text-muted-foreground mt-1 text-xs">Notes: {d.reviewNotes}</p>
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
              if (!studentDocFile) return;
              submitAction(
                async () => {
                  const fileUrl = await uploadFile(studentDocFile);
                  return api.createStudentDocument({ studentId: studentDocForm.studentId, documentType: studentDocForm.documentType, fileUrl });
                },
                () => {
                  setStudentDocForm({ studentId: "", documentType: "" });
                  setStudentDocFile(null);
                  studentDocuments.mutate();
                },
              );
            }}
          >
            <NativeSelect
              className="w-40"
              placeholder="Student"
              value={studentDocForm.studentId}
              onChange={(v) => setStudentDocForm((f) => ({ ...f, studentId: v }))}
              options={(students.data ?? []).map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }))}
            />
            <Input
              className="w-40"
              placeholder="Document type"
              value={studentDocForm.documentType}
              onChange={(e) => setStudentDocForm((f) => ({ ...f, documentType: e.target.value }))}
            />
            <input type="file" onChange={(e) => setStudentDocFile(e.target.files?.[0] ?? null)} className="text-sm" />
            <Button type="submit" size="sm" disabled={!studentDocForm.studentId || !studentDocForm.documentType || !studentDocFile}>
              Upload
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Staff documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!staffDocuments.data || staffDocuments.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No staff documents yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {staffDocuments.data.map((d) => (
                <li key={d.id} className="rounded-md border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      <span className="font-medium">{d.documentType}</span>
                      {d.employee ? (
                        <span className="text-muted-foreground">
                          {" "}
                          — {d.employee.firstName} {d.employee.lastName}
                        </span>
                      ) : null}{" "}
                      <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                        view
                      </a>
                    </span>
                    <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
                  </div>
                  {d.status === "PENDING" ? (
                    <div className="mt-2 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="h-7"
                        onClick={() => submitAction(() => api.reviewStaffDocument(d.id, { status: "VERIFIED" }), () => staffDocuments.mutate())}
                      >
                        Verify
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => submitAction(() => api.reviewStaffDocument(d.id, { status: "REJECTED" }), () => staffDocuments.mutate())}
                      >
                        Reject
                      </Button>
                    </div>
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
              if (!staffDocFile) return;
              submitAction(
                async () => {
                  const fileUrl = await uploadFile(staffDocFile);
                  return api.createStaffDocument({ employeeId: staffDocForm.employeeId, documentType: staffDocForm.documentType, fileUrl });
                },
                () => {
                  setStaffDocForm({ employeeId: "", documentType: "" });
                  setStaffDocFile(null);
                  staffDocuments.mutate();
                },
              );
            }}
          >
            <NativeSelect
              className="w-40"
              placeholder="Employee"
              value={staffDocForm.employeeId}
              onChange={(v) => setStaffDocForm((f) => ({ ...f, employeeId: v }))}
              options={(employees.data ?? []).map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }))}
            />
            <Input
              className="w-40"
              placeholder="Document type"
              value={staffDocForm.documentType}
              onChange={(e) => setStaffDocForm((f) => ({ ...f, documentType: e.target.value }))}
            />
            <input type="file" onChange={(e) => setStaffDocFile(e.target.files?.[0] ?? null)} className="text-sm" />
            <Button type="submit" size="sm" disabled={!staffDocForm.employeeId || !staffDocForm.documentType || !staffDocFile}>
              Upload
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Certificates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!certificates.data || certificates.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No certificates issued yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {certificates.data.map((c) => (
                <li key={c.id} className="rounded-md border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      <span className="font-medium">{c.type}</span>
                      {c.student ? (
                        <span className="text-muted-foreground">
                          {" "}
                          — {c.student.firstName} {c.student.lastName}
                        </span>
                      ) : null}{" "}
                      <span className="text-muted-foreground">· code {c.verificationCode}</span>{" "}
                      <a href={c.fileUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                        view
                      </a>
                    </span>
                    <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                  </div>
                  {c.status === "ISSUED" ? (
                    <div className="mt-2 flex flex-wrap items-end gap-2">
                      <Input
                        className="h-7 w-48"
                        placeholder="Revocation reason (optional)"
                        value={revokeReason[c.id] ?? ""}
                        onChange={(e) => setRevokeReason((m) => ({ ...m, [c.id]: e.target.value }))}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() =>
                          submitAction(
                            () => api.revokeCertificate(c.id, { reason: revokeReason[c.id] || undefined }),
                            () => certificates.mutate(),
                          )
                        }
                      >
                        Revoke
                      </Button>
                    </div>
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
              if (!certificateFile) return;
              submitAction(
                async () => {
                  const fileUrl = await uploadFile(certificateFile);
                  return api.createCertificate({ studentId: certificateForm.studentId, type: certificateForm.type, fileUrl });
                },
                () => {
                  setCertificateForm({ studentId: "", type: "" });
                  setCertificateFile(null);
                  certificates.mutate();
                },
              );
            }}
          >
            <NativeSelect
              className="w-40"
              placeholder="Student"
              value={certificateForm.studentId}
              onChange={(v) => setCertificateForm((f) => ({ ...f, studentId: v }))}
              options={(students.data ?? []).map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }))}
            />
            <Input
              className="w-48"
              placeholder="Certificate type"
              value={certificateForm.type}
              onChange={(e) => setCertificateForm((f) => ({ ...f, type: e.target.value }))}
            />
            <input type="file" onChange={(e) => setCertificateFile(e.target.files?.[0] ?? null)} className="text-sm" />
            <Button type="submit" size="sm" disabled={!certificateForm.studentId || !certificateForm.type || !certificateFile}>
              Issue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
    </FeatureLock>
  );
}
