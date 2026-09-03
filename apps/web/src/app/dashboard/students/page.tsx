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
import { PhotoInput, EMPTY_PHOTO, hasPhoto, resolvePhotoUrl, type PhotoValue } from "@/components/photo-input";
import { Avatar } from "@/components/avatar";
import { EditionUsageBadge } from "@/components/edition-usage-badge";
import { EditionUpgradeBanner } from "@/components/edition-upgrade-banner";
import { api } from "@/lib/api";
import { statusVariant } from "@/lib/status-variant";
import { useHighlightFromSearch } from "@/lib/use-highlight-from-search";
import { isEditionLimitError } from "@/lib/edition-limit-error";
import { useEditionStatus } from "@/lib/use-edition-status";
import { submitAction, submitDelete, errorMessage } from "@/lib/submit-action";
import { ApiError, type Edition, type EnrollmentStatus, type ImportResult } from "@education-erp/api-client";

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
  // Same SWR key dashboard/page.tsx already fetches this under, so
  // this dedupes against that request instead of firing a second one
  // — used to compute a portal login's username, which is
  // deterministic (see handleCreateLogin's own comment below).
  const organization = useSWR("organization", () => api.getOwnOrganization());
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
  const editionStatus = useEditionStatus();
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
  const [studentPhoto, setStudentPhoto] = useState<PhotoValue>(EMPTY_PHOTO);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editStudentForm, setEditStudentForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
  });
  const [editStudentPhoto, setEditStudentPhoto] = useState<PhotoValue>(EMPTY_PHOTO);
  const [guardianForm, setGuardianForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    phone: "",
    email: "",
  });
  const [guardianPhoto, setGuardianPhoto] = useState<PhotoValue>(EMPTY_PHOTO);
  const [editingGuardianId, setEditingGuardianId] = useState<string | null>(null);
  const [editGuardianForm, setEditGuardianForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    phone: "",
    email: "",
  });
  const [editGuardianPhoto, setEditGuardianPhoto] = useState<PhotoValue>(EMPTY_PHOTO);
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
  // Real list view behind the Enrollment card (audit finding #09) —
  // was previously create-only, with no way to see who's enrolled or
  // spot a double-enrollment afterward.
  const [enrollmentsPage, setEnrollmentsPage] = useState(1);
  const [enrollmentFilters, setEnrollmentFilters] = useState({ programId: "", termId: "", sectionId: "", status: "" });
  const enrollments = useSWR(["enrollments", enrollmentsPage, enrollmentFilters], () =>
    api.listAllEnrollments({
      page: enrollmentsPage,
      programId: enrollmentFilters.programId || undefined,
      termId: enrollmentFilters.termId || undefined,
      sectionId: enrollmentFilters.sectionId || undefined,
      status: (enrollmentFilters.status || undefined) as EnrollmentStatus | undefined,
    }),
  );
  const [enrollmentStatusEdits, setEnrollmentStatusEdits] = useState<Record<string, EnrollmentStatus>>({});

  const importFileRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  // Keyed by studentId, same pattern as the exams page's per-row forms.
  const [loginPasswordForms, setLoginPasswordForms] = useState<Record<string, string>>({});

  // The backend derives the username as `${orgSlug}.${studentCode}`
  // (StudentsService.createLogin) — deterministic from data already on
  // the record, so it's computed here rather than only shown once from
  // the create-login response and then lost forever on refresh.
  function studentUsername(studentCode: string): string {
    return organization.data ? `${organization.data.slug}.${studentCode}` : studentCode;
  }

  async function handleCreateLogin(studentId: string) {
    const password = loginPasswordForms[studentId] ?? "";
    try {
      await api.createStudentLogin(studentId, { password });
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
        id="students"
        title="Students"
        titleExtra={<EditionUsageBadge status={editionStatus.data} />}
        emptyLabel="No students yet."
        items={students.data?.data}
        footer={
          <>
            {editingStudentId ? (
              <form
                className="flex flex-wrap items-end gap-3 border-b pb-4"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  submitAction(
                    async () => {
                      const photoUrl = hasPhoto(editStudentPhoto) ? await resolvePhotoUrl(editStudentPhoto) : undefined;
                      return api.updateStudent(editingStudentId, {
                        ...editStudentForm,
                        middleName: editStudentForm.middleName || undefined,
                        gender: editStudentForm.gender || undefined,
                        photoUrl,
                      });
                    },
                    () => {
                      setEditingStudentId(null);
                      students.mutate();
                    },
                  );
                }}
              >
                <div className="space-y-2">
                  <Label>First name</Label>
                  <Input
                    required
                    value={editStudentForm.firstName}
                    onChange={(e) => setEditStudentForm((f) => ({ ...f, firstName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Middle name (optional)</Label>
                  <Input
                    value={editStudentForm.middleName}
                    onChange={(e) => setEditStudentForm((f) => ({ ...f, middleName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last name</Label>
                  <Input
                    required
                    value={editStudentForm.lastName}
                    onChange={(e) => setEditStudentForm((f) => ({ ...f, lastName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date of birth</Label>
                  <Input
                    required
                    type="date"
                    value={editStudentForm.dateOfBirth}
                    onChange={(e) => setEditStudentForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gender (optional)</Label>
                  <NativeSelect
                    className="w-28"
                    placeholder="Select"
                    value={editStudentForm.gender}
                    onChange={(v) => setEditStudentForm((f) => ({ ...f, gender: v }))}
                    options={GENDER_OPTIONS.map((g) => ({ value: g, label: g }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Photo</Label>
                  <PhotoInput value={editStudentPhoto} onChange={setEditStudentPhoto} />
                </div>
                <Button type="submit" size="sm" disabled={!hasPhoto(editStudentPhoto)}>
                  Save
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setEditingStudentId(null)}>
                  Cancel
                </Button>
              </form>
            ) : null}
            {students.data ? (
              <ListPager
                page={students.data.page}
                totalPages={students.data.totalPages}
                onPrev={() => setStudentsPage((p) => Math.max(1, p - 1))}
                onNext={() => setStudentsPage((p) => p + 1)}
              />
            ) : null}
          </>
        }
        renderItem={(s: {
          id: string;
          userId: string | null;
          firstName: string;
          middleName: string | null;
          lastName: string;
          studentCode: string;
          status: string;
          dateOfBirth: string;
          gender: string | null;
          photoUrl: string | null;
          guardians: { relationship: string; guardian: { firstName: string; lastName: string } }[];
        }) => (
          <div id={`student-${s.id}`} className="rounded-md transition-shadow">
            <span className="flex items-center gap-2">
              <Avatar src={s.photoUrl} />
              {s.firstName} {s.middleName ? `${s.middleName} ` : ""}
              {s.lastName} <span className="text-muted-foreground">{s.studentCode}</span>
              <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingStudentId(s.id);
                  setEditStudentForm({
                    firstName: s.firstName,
                    middleName: s.middleName ?? "",
                    lastName: s.lastName,
                    dateOfBirth: s.dateOfBirth.slice(0, 10),
                    gender: s.gender ?? "",
                  });
                  setEditStudentPhoto(s.photoUrl ? { status: "uploaded", url: s.photoUrl } : EMPTY_PHOTO);
                }}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => submitDelete(() => api.deleteStudent(s.id), () => students.mutate())}
              >
                Delete
              </Button>
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
                Portal login: {studentUsername(s.studentCode)}
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
            if (!hasPhoto(studentPhoto)) return;
            submit(
              // A captured-but-not-yet-uploaded photo is uploaded right
              // here, as part of this same Add click — resolvePhotoUrl
              // is a no-op if the photo already has a real URL (picked
              // via the file button, which uploads immediately).
              async () => {
                const photoUrl = await resolvePhotoUrl(studentPhoto);
                return api.createStudent({
                  ...studentForm,
                  middleName: studentForm.middleName || undefined,
                  gender: studentForm.gender || undefined,
                  photoUrl,
                });
              },
              () => {
                setStudentForm({ firstName: "", middleName: "", lastName: "", dateOfBirth: "", gender: "" });
                setStudentPhoto(EMPTY_PHOTO);
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
            <Label>Photo (required)</Label>
            <PhotoInput value={studentPhoto} onChange={setStudentPhoto} />
          </div>
          <div className="flex flex-col items-start gap-1">
            <Button type="submit" disabled={!hasPhoto(studentPhoto)}>
              Add
            </Button>
            {!hasPhoto(studentPhoto) ? (
              <p className="text-muted-foreground text-xs">A photo is required before this can be added.</p>
            ) : null}
          </div>
        </form>
        {editionLimitEdition ? <EditionUpgradeBanner edition={editionLimitEdition} /> : null}
      </EntityCard>

      <EntityCard
        title="Guardians"
        emptyLabel="No guardians yet."
        items={guardians.data}
        footer={
          editingGuardianId ? (
            <form
              className="flex flex-wrap items-end gap-3 border-b pb-4"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                submitAction(
                  async () => {
                    const photoUrl = hasPhoto(editGuardianPhoto) ? await resolvePhotoUrl(editGuardianPhoto) : undefined;
                    return api.updateGuardian(editingGuardianId, {
                      ...editGuardianForm,
                      middleName: editGuardianForm.middleName || undefined,
                      email: editGuardianForm.email || undefined,
                      photoUrl,
                    });
                  },
                  () => {
                    setEditingGuardianId(null);
                    guardians.mutate();
                  },
                );
              }}
            >
              <div className="space-y-2">
                <Label>First name</Label>
                <Input
                  required
                  value={editGuardianForm.firstName}
                  onChange={(e) => setEditGuardianForm((f) => ({ ...f, firstName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Middle name (optional)</Label>
                <Input
                  value={editGuardianForm.middleName}
                  onChange={(e) => setEditGuardianForm((f) => ({ ...f, middleName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Last name</Label>
                <Input
                  required
                  value={editGuardianForm.lastName}
                  onChange={(e) => setEditGuardianForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  required
                  value={editGuardianForm.phone}
                  onChange={(e) => setEditGuardianForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Email (optional)</Label>
                <Input
                  type="email"
                  value={editGuardianForm.email}
                  onChange={(e) => setEditGuardianForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Photo</Label>
                <PhotoInput value={editGuardianPhoto} onChange={setEditGuardianPhoto} />
              </div>
              <Button type="submit" size="sm" disabled={!hasPhoto(editGuardianPhoto)}>
                Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingGuardianId(null)}>
                Cancel
              </Button>
            </form>
          ) : null
        }
        renderItem={(g: {
          id: string;
          firstName: string;
          middleName: string | null;
          lastName: string;
          phone: string;
          email: string | null;
          photoUrl: string | null;
        }) => (
          <span id={`guardian-${g.id}`} className="flex items-center gap-2">
            <Avatar src={g.photoUrl} />
            {g.firstName} {g.middleName ? `${g.middleName} ` : ""}
            {g.lastName} <span className="text-muted-foreground">{g.phone}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingGuardianId(g.id);
                setEditGuardianForm({
                  firstName: g.firstName,
                  middleName: g.middleName ?? "",
                  lastName: g.lastName,
                  phone: g.phone,
                  email: g.email ?? "",
                });
                setEditGuardianPhoto(g.photoUrl ? { status: "uploaded", url: g.photoUrl } : EMPTY_PHOTO);
              }}
            >
              Edit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => submitDelete(() => api.deleteGuardian(g.id), () => guardians.mutate())}
            >
              Delete
            </Button>
          </span>
        )}
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (!hasPhoto(guardianPhoto)) return;
            submit(
              async () => {
                const photoUrl = await resolvePhotoUrl(guardianPhoto);
                return api.createGuardian({
                  ...guardianForm,
                  middleName: guardianForm.middleName || undefined,
                  email: guardianForm.email || undefined,
                  photoUrl,
                });
              },
              () => {
                setGuardianForm({ firstName: "", middleName: "", lastName: "", phone: "", email: "" });
                setGuardianPhoto(EMPTY_PHOTO);
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
            <Label>Photo (required)</Label>
            <PhotoInput value={guardianPhoto} onChange={setGuardianPhoto} />
          </div>
          <div className="flex flex-col items-start gap-1">
            <Button type="submit" disabled={!hasPhoto(guardianPhoto)}>
              Add
            </Button>
            {!hasPhoto(guardianPhoto) ? (
              <p className="text-muted-foreground text-xs">A photo is required before this can be added.</p>
            ) : null}
          </div>
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
                setLinkForm((f) => ({ ...f, relationship: "", isPrimaryContact: true }));
                students.mutate();
              },
            );
          }}
        >
          <p className="w-full text-sm font-medium">Link guardian to student</p>
          <div className="space-y-2">
            <Label>Student</Label>
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
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={linkForm.isPrimaryContact}
              onChange={(e) => setLinkForm((f) => ({ ...f, isPrimaryContact: e.target.checked }))}
            />
            Primary contact
          </label>
          <Button type="submit" disabled={!linkForm.studentId || !linkForm.guardianId || !linkForm.relationship}>
            Link
          </Button>
        </form>
      </EntityCard>

      <EntityCard
        id="enrollment"
        title="Enrollment"
        emptyLabel="No enrollments match these filters."
        items={enrollments.data?.data}
        footer={
          enrollments.data ? (
            <ListPager
              page={enrollments.data.page}
              totalPages={enrollments.data.totalPages}
              onPrev={() => setEnrollmentsPage((p) => Math.max(1, p - 1))}
              onNext={() => setEnrollmentsPage((p) => p + 1)}
            />
          ) : null
        }
        renderItem={(en: {
          id: string;
          status: EnrollmentStatus;
          student: { firstName: string; lastName: string; studentCode: string };
          program: { name: string };
          section: { name: string };
          term: { name: string };
        }) => (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {en.student.firstName} {en.student.lastName}{" "}
              <span className="text-muted-foreground">({en.student.studentCode})</span> — {en.program.name} ·{" "}
              {en.section.name} · {en.term.name}
            </span>
            <div className="flex items-center gap-2">
              <Badge variant={statusVariant(en.status)}>{en.status}</Badge>
              <NativeSelect
                className="h-7 w-32"
                placeholder="Change status"
                value={enrollmentStatusEdits[en.id] ?? ""}
                onChange={(v) => setEnrollmentStatusEdits((f) => ({ ...f, [en.id]: v as EnrollmentStatus }))}
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "COMPLETED", label: "Completed" },
                  { value: "WITHDRAWN", label: "Withdrawn" },
                ].filter((o) => o.value !== en.status)}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7"
                disabled={!enrollmentStatusEdits[en.id]}
                onClick={() =>
                  submitAction(
                    () => api.updateEnrollmentStatus(en.id, enrollmentStatusEdits[en.id]),
                    () => {
                      setEnrollmentStatusEdits((f) => {
                        const next = { ...f };
                        delete next[en.id];
                        return next;
                      });
                      enrollments.mutate();
                    },
                  )
                }
              >
                Update
              </Button>
            </div>
          </div>
        )}
      >
        <div className="flex flex-wrap items-end gap-3 pb-3">
          <div className="space-y-1">
            <Label className="text-xs">Filter by program</Label>
            <NativeSelect
              className="h-8 w-40"
              placeholder="All programs"
              value={enrollmentFilters.programId}
              onChange={(v) => {
                setEnrollmentFilters((f) => ({ ...f, programId: v }));
                setEnrollmentsPage(1);
              }}
              options={(programs.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Filter by term</Label>
            <NativeSelect
              className="h-8 w-32"
              placeholder="All terms"
              value={enrollmentFilters.termId}
              onChange={(v) => {
                setEnrollmentFilters((f) => ({ ...f, termId: v }));
                setEnrollmentsPage(1);
              }}
              options={(terms.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Filter by section</Label>
            <NativeSelect
              className="h-8 w-32"
              placeholder="All sections"
              value={enrollmentFilters.sectionId}
              onChange={(v) => {
                setEnrollmentFilters((f) => ({ ...f, sectionId: v }));
                setEnrollmentsPage(1);
              }}
              options={(sections.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Filter by status</Label>
            <NativeSelect
              className="h-8 w-32"
              placeholder="All statuses"
              value={enrollmentFilters.status}
              onChange={(v) => {
                setEnrollmentFilters((f) => ({ ...f, status: v }));
                setEnrollmentsPage(1);
              }}
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "COMPLETED", label: "Completed" },
                { value: "WITHDRAWN", label: "Withdrawn" },
              ]}
            />
          </div>
        </div>

        <Separator className="mb-3" />

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
                enrollments.mutate();
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
              onChange={(v) => setEnrollForm((f) => ({ ...f, programId: v, sectionId: "" }))}
              options={(programs.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Term</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select term"
              value={enrollForm.termId}
              onChange={(v) => setEnrollForm((f) => ({ ...f, termId: v, sectionId: "" }))}
              options={(terms.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Section</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select section"
              value={enrollForm.sectionId}
              onChange={(v) => setEnrollForm((f) => ({ ...f, sectionId: v }))}
              // Filtered by the chosen Program/Term above — previously
              // this listed every section in the org regardless of
              // what was picked (audit finding #09's own footnote).
              options={(sections.data ?? [])
                .filter(
                  (s) =>
                    (!enrollForm.programId || s.programId === enrollForm.programId) &&
                    (!enrollForm.termId || s.termId === enrollForm.termId),
                )
                .map((s) => ({ value: s.id, label: s.name }))}
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
