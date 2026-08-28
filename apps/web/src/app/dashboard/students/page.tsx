"use client";

import { useRef, useState, type FormEvent } from "react";
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
import { PhotoInput } from "@/components/photo-input";
import { Avatar } from "@/components/avatar";
import { EditionUsageBadge } from "@/components/edition-usage-badge";
import { EditionUpgradeBanner } from "@/components/edition-upgrade-banner";
import { api } from "@/lib/api";
import { statusVariant } from "@/lib/status-variant";
import { useHighlightFromSearch } from "@/lib/use-highlight-from-search";
import { isEditionLimitError } from "@/lib/edition-limit-error";
import { errorMessage } from "@/lib/submit-action";
import { ApiError, type Edition, type ImportResult } from "@education-erp/api-client";

// Matches the backend's GENDER_OPTIONS
// (services/api/src/modules/students/students.service.ts) exactly —
// the same list the CSV/Excel import validates against and the
// import template's dropdown offers, so a record created here is
// never rejected on re-import. Update both places together.
const GENDER_OPTIONS = ["Male", "Female", "Other"] as const;

// Matches the backend's RELATIONSHIP_OPTIONS
// (services/api/src/modules/students/students.service.ts) exactly —
// the stored value is always the plain English label (e.g. "Father"),
// same as GENDER_OPTIONS; the Nepali translation shown alongside it
// here is display-only, not persisted separately.
const RELATIONSHIP_OPTIONS = [
  { label: "Father", nepali: "बुबा" },
  { label: "Mother", nepali: "आमा" },
  { label: "Son", nepali: "छोरा" },
  { label: "Daughter", nepali: "छोरी" },
  { label: "Husband", nepali: "श्रीमान्" },
  { label: "Wife", nepali: "श्रीमती" },
  { label: "Brother", nepali: "दाजु/भाइ" },
  { label: "Sister", nepali: "दिदी/बहिनी" },
  { label: "Grandfather", nepali: "हजुरबुबा" },
  { label: "Grandmother", nepali: "हजुरआमा" },
  { label: "Uncle", nepali: "काका/मामा" },
  { label: "Aunt", nepali: "काकी/माइजू/फुपू" },
  { label: "Cousin", nepali: "काकाको/मामाको छोरा/छोरी" },
  { label: "Friend", nepali: "साथी" },
  { label: "Colleague", nepali: "सहकर्मी" },
  { label: "Supervisor", nepali: "सुपरिवेक्षक" },
  { label: "Subordinate", nepali: "मातहत कर्मचारी" },
  { label: "Neighbor", nepali: "छिमेकी" },
  { label: "Guardian", nepali: "अभिभावक" },
  { label: "Emergency Contact", nepali: "आपतकालीन सम्पर्क" },
  { label: "Associate", nepali: "सम्बन्धित व्यक्ति" },
  { label: "Business Partner", nepali: "व्यावसायिक साझेदार" },
  { label: "Unknown", nepali: "अज्ञात" },
] as const;

export default function StudentsPage() {
  // Paginated (Phase 8 performance-optimization slice) — studentsPage
  // is part of the SWR key so changing it triggers a fresh fetch of
  // that page, same pattern used by every other paginated list below.
  const [studentsPage, setStudentsPage] = useState(1);
  const students = useSWR(["students", studentsPage], () => api.listStudents({ page: studentsPage }));
  // Deliberately separate from the paginated `students` above — every
  // "pick a student" dropdown on this page needs the whole roster, not
  // one page of it (Phase 8 performance-optimization slice).
  const studentsPicker = useSWR("students-picker", () => api.listStudentsPicker());
  const guardians = useSWR("guardians", () => api.listGuardians());
  const programs = useSWR("programs", () => api.listPrograms());
  const sections = useSWR("sections", () => api.listSections());
  const terms = useSWR("terms", () => api.listTerms());
  const editionStatus = useSWR("edition-status", () => api.getEditionStatus());
  const [editionLimitEdition, setEditionLimitEdition] = useState<Edition | null>(null);
  useHighlightFromSearch(Boolean(students.data && guardians.data));

  // studentCode is system-generated (sequential per organization), not
  // part of this form.
  const [studentForm, setStudentForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
  });
  const [studentPhotoUrl, setStudentPhotoUrl] = useState<string | null>(null);
  const [guardianForm, setGuardianForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    phone: "",
    email: "",
  });
  const [guardianPhotoUrl, setGuardianPhotoUrl] = useState<string | null>(null);
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
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

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
      studentsPicker.mutate();
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

  async function handleDownloadTemplate() {
    setDownloadingTemplate(true);
    try {
      const blob = await api.downloadStudentImportTemplate();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "students-import-template.xlsx";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download the template");
    } finally {
      setDownloadingTemplate(false);
    }
  }

  async function submit(action: () => Promise<unknown>, onSuccess: () => void) {
    try {
      await action();
      onSuccess();
      toast.success("Saved");
      editionStatus.mutate();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && isEditionLimitError(err.body)) {
        setEditionLimitEdition(err.body.edition);
        return;
      }
      toast.error(errorMessage(err, "Failed — check that required fields are filled in"));
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
              <Label>Import students (Excel template or CSV)</Label>
              <Input
                ref={importFileRef}
                type="file"
                accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="w-64"
              />
            </div>
            <Button type="button" disabled={importing} onClick={handleImport}>
              {importing ? "Importing..." : "Import"}
            </Button>
            <Button type="button" variant="outline" disabled={downloadingTemplate} onClick={handleDownloadTemplate}>
              {downloadingTemplate ? "Downloading..." : "Download template"}
            </Button>
            <Button type="button" variant="outline" disabled={exporting} onClick={handleExport}>
              {exporting ? "Exporting..." : "Export CSV"}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Columns: studentCode, firstName, lastName, dateOfBirth, gender (optional — Male, Female
            or Other). The Excel template includes a dropdown for gender so entries stay
            standardized; CSV works too if you already have one.
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
        titleExtra={<EditionUsageBadge status={editionStatus.data} />}
        emptyLabel="No students yet."
        items={students.data?.data}
        footer={
          students.data ? (
            <ListPager
              page={students.data.page}
              totalPages={students.data.totalPages}
              onPrev={() => setStudentsPage((p) => Math.max(1, p - 1))}
              onNext={() => setStudentsPage((p) => p + 1)}
            />
          ) : null
        }
        renderItem={(s: {
          id: string;
          userId: string | null;
          firstName: string;
          middleName: string | null;
          lastName: string;
          studentCode: string;
          status: string;
          photoUrl: string | null;
          guardians: { relationship: string; guardian: { firstName: string; lastName: string } }[];
        }) => (
          <div id={`student-${s.id}`} className="rounded-md transition-shadow">
            <span className="flex items-center gap-2">
              <Avatar src={s.photoUrl} />
              {s.firstName} {s.middleName ? `${s.middleName} ` : ""}
              {s.lastName} <span className="text-muted-foreground">{s.studentCode}</span>
              <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
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
            if (!studentPhotoUrl) return;
            submit(
              () =>
                api.createStudent({
                  ...studentForm,
                  middleName: studentForm.middleName || undefined,
                  gender: studentForm.gender || undefined,
                  photoUrl: studentPhotoUrl,
                }),
              () => {
                setStudentForm({ firstName: "", middleName: "", lastName: "", dateOfBirth: "", gender: "" });
                setStudentPhotoUrl(null);
                setEditionLimitEdition(null);
                students.mutate();
                studentsPicker.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>First name</Label>
            <Input
              required
              value={studentForm.firstName}
              onChange={(e) => setStudentForm((f) => ({ ...f, firstName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Middle name (optional)</Label>
            <Input
              value={studentForm.middleName}
              onChange={(e) => setStudentForm((f) => ({ ...f, middleName: e.target.value }))}
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
            <NativeSelect
              className="w-28"
              placeholder="Select"
              value={studentForm.gender}
              onChange={(v) => setStudentForm((f) => ({ ...f, gender: v }))}
              options={GENDER_OPTIONS.map((g) => ({ value: g, label: g }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Photo</Label>
            <PhotoInput value={studentPhotoUrl} onChange={setStudentPhotoUrl} />
          </div>
          <Button type="submit" disabled={!studentPhotoUrl}>
            Add
          </Button>
        </form>
        {editionLimitEdition ? <EditionUpgradeBanner edition={editionLimitEdition} /> : null}
      </EntityCard>

      <EntityCard
        title="Guardians"
        emptyLabel="No guardians yet."
        items={guardians.data}
        renderItem={(g: {
          id: string;
          firstName: string;
          middleName: string | null;
          lastName: string;
          phone: string;
          photoUrl: string | null;
        }) => (
          <span id={`guardian-${g.id}`} className="flex items-center gap-2">
            <Avatar src={g.photoUrl} />
            {g.firstName} {g.middleName ? `${g.middleName} ` : ""}
            {g.lastName} <span className="text-muted-foreground">{g.phone}</span>
          </span>
        )}
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (!guardianPhotoUrl) return;
            submit(
              () =>
                api.createGuardian({
                  ...guardianForm,
                  middleName: guardianForm.middleName || undefined,
                  email: guardianForm.email || undefined,
                  photoUrl: guardianPhotoUrl,
                }),
              () => {
                setGuardianForm({ firstName: "", middleName: "", lastName: "", phone: "", email: "" });
                setGuardianPhotoUrl(null);
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
            <Label>Middle name (optional)</Label>
            <Input
              value={guardianForm.middleName}
              onChange={(e) => setGuardianForm((f) => ({ ...f, middleName: e.target.value }))}
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
          <div className="space-y-2">
            <Label>Photo</Label>
            <PhotoInput value={guardianPhotoUrl} onChange={setGuardianPhotoUrl} />
          </div>
          <Button type="submit" disabled={!guardianPhotoUrl}>
            Add
          </Button>
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
              options={(studentsPicker.data ?? []).map((s) => ({
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
            <NativeSelect
              className="w-40"
              placeholder="Select relationship"
              value={linkForm.relationship}
              onChange={(v) => setLinkForm((f) => ({ ...f, relationship: v }))}
              options={RELATIONSHIP_OPTIONS.map((r) => ({ value: r.label, label: `${r.label} (${r.nepali})` }))}
            />
          </div>
          <Button type="submit" disabled={!linkForm.studentId || !linkForm.guardianId || !linkForm.relationship}>
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
              options={(studentsPicker.data ?? []).map((s) => ({
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
