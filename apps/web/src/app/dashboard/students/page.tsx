"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import type { ImportResult } from "@education-erp/api-client";

function EntityCard({
  title,
  emptyLabel,
  items,
  renderItem,
  children,
}: {
  title: string;
  emptyLabel: string;
  items: unknown[] | undefined;
  renderItem: (item: never) => ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!items || items.length === 0 ? (
          <p className="text-muted-foreground text-sm">{emptyLabel}</p>
        ) : (
          <ul className="divide-y">
            {items.map((item, i) => (
              <li key={i} className="py-2 text-sm">
                {renderItem(item as never)}
              </li>
            ))}
          </ul>
        )}
        <Separator />
        {children}
      </CardContent>
    </Card>
  );
}

export default function StudentsPage() {
  const students = useSWR("students", () => api.listStudents());
  const guardians = useSWR("guardians", () => api.listGuardians());
  const programs = useSWR("programs", () => api.listPrograms());
  const sections = useSWR("sections", () => api.listSections());
  const terms = useSWR("terms", () => api.listTerms());

  const [studentForm, setStudentForm] = useState({
    studentCode: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
  });
  const [guardianForm, setGuardianForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
  });
  const [linkForm, setLinkForm] = useState({
    studentId: "",
    guardianId: "",
    relationship: "",
    isPrimaryContact: true,
  });
  const [enrollForm, setEnrollForm] = useState({
    studentId: "",
    programId: "",
    sectionId: "",
    termId: "",
    enrollmentDate: "",
  });

  const importFileRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Keyed by studentId, same pattern as the exams page's per-row forms.
  const [loginPasswordForms, setLoginPasswordForms] = useState<Record<string, string>>({});
  // The generated username is only ever visible in the create-login
  // response — shown here once so the admin can copy it, not persisted.
  const [createdUsernames, setCreatedUsernames] = useState<Record<string, string>>({});

  async function handleCreateLogin(studentId: string) {
    const password = loginPasswordForms[studentId] ?? "";
    try {
      const result = await api.createStudentLogin(studentId, { password });
      setCreatedUsernames((m) => ({ ...m, [studentId]: result.username }));
      setLoginPasswordForms((f) => ({ ...f, [studentId]: "" }));
      students.mutate();
      toast.success("Login created");
    } catch {
      toast.error("Failed to create login — password must be at least 8 characters");
    }
  }

  async function handleImport() {
    const file = importFileRef.current?.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const result = await api.importStudents(file);
      setImportResult(result);
      students.mutate();
      if (importFileRef.current) importFileRef.current.value = "";
      toast.success(`Imported ${result.created} of ${result.totalRows} row(s)`);
    } catch {
      toast.error("Import failed — check the file is a valid CSV");
    } finally {
      setImporting(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await api.exportStudents();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "students.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  }

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
        <h1 className="text-2xl font-semibold">Students</h1>
        <p className="text-muted-foreground text-sm">
          Guardians are a shared catalog (siblings can share one). Enrollment links a student to
          a program, section and term.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import / Export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label>Import students (CSV)</Label>
              <Input
                ref={importFileRef}
                type="file"
                accept=".csv,text/csv"
                className="w-64"
              />
            </div>
            <Button type="button" disabled={importing} onClick={handleImport}>
              {importing ? "Importing..." : "Import"}
            </Button>
            <Button type="button" variant="outline" disabled={exporting} onClick={handleExport}>
              {exporting ? "Exporting..." : "Export CSV"}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            CSV columns: studentCode, firstName, lastName, dateOfBirth, gender (optional)
          </p>
          {importResult ? (
            <div className="text-sm">
              <p>
                {importResult.created} of {importResult.totalRows} row(s) created.
              </p>
              {importResult.errors.length > 0 ? (
                <ul className="text-destructive mt-2 list-disc space-y-1 pl-5">
                  {importResult.errors.map((e, i) => (
                    <li key={i}>
                      Row {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <EntityCard
        title="Students"
        emptyLabel="No students yet."
        items={students.data}
        renderItem={(s: {
          id: string;
          userId: string | null;
          firstName: string;
          lastName: string;
          studentCode: string;
          status: string;
          guardians: { relationship: string; guardian: { firstName: string; lastName: string } }[];
        }) => (
          <div>
            <span>
              {s.firstName} {s.lastName}{" "}
              <span className="text-muted-foreground">
                {s.studentCode} · {s.status}
              </span>
            </span>
            {s.guardians.length > 0 ? (
              <p className="text-muted-foreground mt-1 text-xs">
                {s.guardians
                  .map((g) => `${g.guardian.firstName} ${g.guardian.lastName} (${g.relationship})`)
                  .join(", ")}
              </p>
            ) : null}
            {s.userId ? (
              <p className="text-muted-foreground mt-1 text-xs">
                Portal login: {createdUsernames[s.id] ?? "created"}
              </p>
            ) : (
              <form
                className="mt-2 flex items-end gap-2"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  handleCreateLogin(s.id);
                }}
              >
                <Input
                  type="password"
                  className="h-7 w-40"
                  placeholder="Set initial password"
                  value={loginPasswordForms[s.id] ?? ""}
                  onChange={(e) => setLoginPasswordForms((f) => ({ ...f, [s.id]: e.target.value }))}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  className="h-7"
                  disabled={(loginPasswordForms[s.id] ?? "").length < 8}
                >
                  Create login
                </Button>
              </form>
            )}
          </div>
        )}
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(
              () => api.createStudent({ ...studentForm, gender: studentForm.gender || undefined }),
              () => {
                setStudentForm({ studentCode: "", firstName: "", lastName: "", dateOfBirth: "", gender: "" });
                students.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Student code</Label>
            <Input
              required
              className="w-28"
              value={studentForm.studentCode}
              onChange={(e) => setStudentForm((f) => ({ ...f, studentCode: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>First name</Label>
            <Input
              required
              value={studentForm.firstName}
              onChange={(e) => setStudentForm((f) => ({ ...f, firstName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Last name</Label>
            <Input
              required
              value={studentForm.lastName}
              onChange={(e) => setStudentForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Date of birth</Label>
            <Input
              required
              type="date"
              value={studentForm.dateOfBirth}
              onChange={(e) => setStudentForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Gender (optional)</Label>
            <Input
              className="w-28"
              value={studentForm.gender}
              onChange={(e) => setStudentForm((f) => ({ ...f, gender: e.target.value }))}
            />
          </div>
          <Button type="submit">Add</Button>
        </form>
      </EntityCard>

      <EntityCard
        title="Guardians"
        emptyLabel="No guardians yet."
        items={guardians.data}
        renderItem={(g: { firstName: string; lastName: string; phone: string }) => (
          <span>
            {g.firstName} {g.lastName} <span className="text-muted-foreground">{g.phone}</span>
          </span>
        )}
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(
              () => api.createGuardian({ ...guardianForm, email: guardianForm.email || undefined }),
              () => {
                setGuardianForm({ firstName: "", lastName: "", phone: "", email: "" });
                guardians.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>First name</Label>
            <Input
              required
              value={guardianForm.firstName}
              onChange={(e) => setGuardianForm((f) => ({ ...f, firstName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Last name</Label>
            <Input
              required
              value={guardianForm.lastName}
              onChange={(e) => setGuardianForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              required
              value={guardianForm.phone}
              onChange={(e) => setGuardianForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Email (optional)</Label>
            <Input
              type="email"
              value={guardianForm.email}
              onChange={(e) => setGuardianForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <Button type="submit">Add</Button>
        </form>

        <Separator />

        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(
              () =>
                api.attachGuardian(linkForm.studentId, {
                  guardianId: linkForm.guardianId,
                  relationship: linkForm.relationship,
                  isPrimaryContact: linkForm.isPrimaryContact,
                }),
              () => {
                setLinkForm((f) => ({ ...f, relationship: "" }));
                students.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Link guardian to student</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select student"
              value={linkForm.studentId}
              onChange={(v) => setLinkForm((f) => ({ ...f, studentId: v }))}
              options={(students.data ?? []).map((s) => ({
                value: s.id,
                label: `${s.firstName} ${s.lastName}`,
              }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Guardian</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select guardian"
              value={linkForm.guardianId}
              onChange={(v) => setLinkForm((f) => ({ ...f, guardianId: v }))}
              options={(guardians.data ?? []).map((g) => ({
                value: g.id,
                label: `${g.firstName} ${g.lastName}`,
              }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Relationship</Label>
            <Input
              required
              className="w-28"
              placeholder="Father"
              value={linkForm.relationship}
              onChange={(e) => setLinkForm((f) => ({ ...f, relationship: e.target.value }))}
            />
          </div>
          <Button type="submit" disabled={!linkForm.studentId || !linkForm.guardianId}>
            Link
          </Button>
        </form>
      </EntityCard>

      <EntityCard
        title="Enrollment"
        emptyLabel="Enroll a student in a program, section and term."
        items={undefined}
        renderItem={() => null}
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(
              () =>
                api.createEnrollment(enrollForm.studentId, {
                  programId: enrollForm.programId,
                  sectionId: enrollForm.sectionId,
                  termId: enrollForm.termId,
                  enrollmentDate: enrollForm.enrollmentDate,
                }),
              () => {
                setEnrollForm((f) => ({ ...f, programId: "", sectionId: "", termId: "", enrollmentDate: "" }));
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Student</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select student"
              value={enrollForm.studentId}
              onChange={(v) => setEnrollForm((f) => ({ ...f, studentId: v }))}
              options={(students.data ?? []).map((s) => ({
                value: s.id,
                label: `${s.firstName} ${s.lastName}`,
              }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Program</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select program"
              value={enrollForm.programId}
              onChange={(v) => setEnrollForm((f) => ({ ...f, programId: v }))}
              options={(programs.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Section</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select section"
              value={enrollForm.sectionId}
              onChange={(v) => setEnrollForm((f) => ({ ...f, sectionId: v }))}
              options={(sections.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Term</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select term"
              value={enrollForm.termId}
              onChange={(v) => setEnrollForm((f) => ({ ...f, termId: v }))}
              options={(terms.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Enrollment date</Label>
            <Input
              required
              type="date"
              value={enrollForm.enrollmentDate}
              onChange={(e) => setEnrollForm((f) => ({ ...f, enrollmentDate: e.target.value }))}
            />
          </div>
          <Button
            type="submit"
            disabled={
              !enrollForm.studentId || !enrollForm.programId || !enrollForm.sectionId || !enrollForm.termId
            }
          >
            Enroll
          </Button>
        </form>
      </EntityCard>
    </div>
  );
}
