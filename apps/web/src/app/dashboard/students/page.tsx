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
import { PersonPicker, studentToPersonOption } from "@/components/person-picker";
import { Separator } from "@/components/ui/separator";
import { EntityCard } from "@/components/dashboard/entity-card";
import { ListPager } from "@/components/dashboard/list-pager";
import { PhotoInput, EMPTY_PHOTO, hasPhoto, resolvePhotoUrl, type PhotoValue } from "@/components/photo-input";
import { Avatar } from "@/components/avatar";
import { EditionUsageBadge } from "@/components/edition-usage-badge";
import { EditionUpgradeBanner } from "@/components/edition-upgrade-banner";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { downloadBlob } from "@/lib/download";
import { statusVariant } from "@/lib/status-variant";
import { useHighlightFromSearch } from "@/lib/use-highlight-from-search";
import { isEditionLimitError } from "@/lib/edition-limit-error";
import { useEditionStatus } from "@/lib/use-edition-status";
import { submitAction, submitDelete, errorMessage } from "@/lib/submit-action";
import {
  ApiError,
  type Edition,
  type EnrollmentStatus,
  type ImportResult,
  type StudentStatus,
  type ExtracurricularActivityLookupKind,
  type ActivityLookupRecord,
} from "@education-erp/api-client";
import { todayLocalDateString } from "@/lib/local-date";

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

// Sources its options from the org's own ExtracurricularActivityLookup
// catalog for that `kind` and lets the picker add a new standard value
// inline — mirrors dashboard/hostel/page.tsx's LookupSelect exactly,
// repointed at the activity-lookup endpoints since that component isn't
// parameterized over which API function to call.
function ActivityLookupSelect({
  kind,
  value,
  onChange,
  options,
  onCreated,
  placeholder,
  className,
}: {
  kind: ExtracurricularActivityLookupKind;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  onCreated: () => void;
  placeholder: string;
  className?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState("");

  if (adding) {
    return (
      <div className="flex items-end gap-1">
        <div className="space-y-1">
          <Label className="text-xs">New {placeholder.toLowerCase()}</Label>
          <Input className={className ?? "w-32"} value={newValue} onChange={(e) => setNewValue(e.target.value)} autoFocus />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!newValue.trim()}
          onClick={() =>
            submitAction(
              () => api.createActivityLookup({ kind, name: newValue.trim() }),
              () => {
                onChange(newValue.trim());
                setNewValue("");
                setAdding(false);
                onCreated();
              },
            )
          }
        >
          Add
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <NativeSelect
      className={className}
      placeholder={placeholder}
      value={value}
      onChange={(v) => (v === "__add_new__" ? setAdding(true) : onChange(v))}
      options={[...options.map((o) => ({ value: o, label: o })), { value: "__add_new__", label: "+ Add new…" }]}
    />
  );
}

// Edit/Delete UI for one ExtracurricularActivityLookup kind's catalog —
// mirrors dashboard/hostel/page.tsx's LookupManageList exactly. Only
// `name` is editable and delete has no dependency guard on the backend,
// by design (see StudentsService.deleteActivityLookup's comment).
function ActivityLookupManageList({
  title,
  data,
  mutate,
}: {
  title: string;
  data: ActivityLookupRecord[] | undefined;
  mutate: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "" });

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium">{title}</p>
      {!data || data.length === 0 ? (
        <p className="text-muted-foreground text-xs">None yet.</p>
      ) : (
        <ul className="divide-y text-sm">
          {data.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 py-2">
              <span>{l.name}</span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingId(l.id);
                    setEditForm({ name: l.name });
                  }}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => submitDelete(() => api.deleteActivityLookup(l.id), () => mutate())}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editingId ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submitAction(() => api.updateActivityLookup(editingId, editForm), () => {
              setEditingId(null);
              mutate();
            });
          }}
        >
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input className="h-7 w-40" value={editForm.name} onChange={(e) => setEditForm({ name: e.target.value })} />
          </div>
          <Button type="submit" size="sm" className="h-7" disabled={!editForm.name}>
            Save
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => setEditingId(null)}>
            Cancel
          </Button>
        </form>
      ) : null}
    </div>
  );
}

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
  const semesters = useSWR("semesters", () => api.listSemesters());
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
    semesterId: "",
    enrollmentDate: "",
  });
  // Real list view behind the Enrollment card (audit finding #09) —
  // was previously create-only, with no way to see who's enrolled or
  // spot a double-enrollment afterward.
  const [enrollmentsPage, setEnrollmentsPage] = useState(1);
  const [enrollmentFilters, setEnrollmentFilters] = useState({ programId: "", semesterId: "", sectionId: "", status: "" });
  const enrollments = useSWR(["enrollments", enrollmentsPage, enrollmentFilters], () =>
    api.listAllEnrollments({
      page: enrollmentsPage,
      programId: enrollmentFilters.programId || undefined,
      semesterId: enrollmentFilters.semesterId || undefined,
      sectionId: enrollmentFilters.sectionId || undefined,
      status: (enrollmentFilters.status || undefined) as EnrollmentStatus | undefined,
    }),
  );
  const [enrollmentStatusEdits, setEnrollmentStatusEdits] = useState<Record<string, EnrollmentStatus>>({});
  const [studentStatusEdits, setStudentStatusEdits] = useState<Record<string, StudentStatus>>({});

  // ── Extra-curricular activities ──────────────────────────────────
  const activityTitleLookups = useSWR("activity-lookups-title", () => api.listActivityLookups("ACTIVITY_TITLE"));
  const activityRoleLookups = useSWR("activity-lookups-role", () => api.listActivityLookups("ACTIVITY_ROLE"));
  const [activitiesPage, setActivitiesPage] = useState(1);
  const [activityStudentFilter, setActivityStudentFilter] = useState("");
  const activities = useSWR(["activities", activitiesPage, activityStudentFilter], () =>
    api.listAllExtracurricularActivities({
      page: activitiesPage,
      studentId: activityStudentFilter || undefined,
    }),
  );
  const [activityForm, setActivityForm] = useState({
    studentId: "",
    title: "",
    role: "",
    description: "",
    startDate: "",
    endDate: "",
  });
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [editActivityForm, setEditActivityForm] = useState({
    title: "",
    role: "",
    description: "",
    startDate: "",
    endDate: "",
  });

  const importFileRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [downloadingEditable, setDownloadingEditable] = useState(false);

  // Keyed by studentId, same pattern as the exams page's per-row forms.
  const [loginPasswordForms, setLoginPasswordForms] = useState<Record<string, string>>({});

  // The backend derives the username as `${orgSlug}.${studentCode}`
  // (StudentsService.createLogin) — deterministic from data already on
  // the record, so it's computed here rather than only shown once from
  // the create-login response and then lost forever on refresh.
  function studentUsername(studentCode: string): string {
    return organization.data ? `${organization.data.slug}.${studentCode}` : studentCode;
  }

  function handleCreateLogin(studentId: string) {
    const password = loginPasswordForms[studentId] ?? "";
    submitAction(
      () => api.createStudentLogin(studentId, { password }),
      () => {
        setLoginPasswordForms((f) => ({ ...f, [studentId]: "" }));
        students.mutate();
      },
      "Login created",
      "Creating login…",
    );
  }

  // Keyed by guardianId, same pattern as loginPasswordForms above.
  const [guardianLoginPasswordForms, setGuardianLoginPasswordForms] = useState<Record<string, string>>({});

  // The backend derives the username as `${orgSlug}.guardian.${id.slice(0, 8)}`
  // (StudentsService.createGuardianLogin) — deterministic, computed the
  // same way studentUsername is above rather than only shown once.
  function guardianUsername(guardianId: string): string {
    return organization.data ? `${organization.data.slug}.guardian.${guardianId.slice(0, 8)}` : guardianId;
  }

  function handleCreateGuardianLogin(guardianId: string) {
    const password = guardianLoginPasswordForms[guardianId] ?? "";
    submitAction(
      () => api.createGuardianLogin(guardianId, { password }),
      () => {
        setGuardianLoginPasswordForms((f) => ({ ...f, [guardianId]: "" }));
        guardians.mutate();
      },
      "Login created",
      "Creating login…",
    );
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
      toast.success(`${result.created} created, ${result.updated} updated (of ${result.totalRows} row(s))`);
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

  // The other half of the round trip: current students pre-filled into
  // the same template, so editing this file and re-importing it updates
  // existing rows instead of rejecting them as duplicates.
  async function handleDownloadEditable() {
    setDownloadingEditable(true);
    try {
      const blob = await api.exportStudentsEditable();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "students-editable.xlsx";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download the editable copy");
    } finally {
      setDownloadingEditable(false);
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
          a program, section and semester.
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
            <Button type="button" variant="outline" disabled={downloadingEditable} onClick={handleDownloadEditable}>
              {downloadingEditable ? "Downloading..." : "Download editable copy"}
            </Button>
            <Button type="button" variant="outline" disabled={exporting} onClick={handleExport}>
              {exporting ? "Exporting..." : "Export CSV"}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Columns: studentCode, firstName, lastName, dateOfBirth, gender (optional — Male, Female
            or Other). The Excel template includes a dropdown for gender so entries stay
            standardized; CSV works too if you already have one. Leave studentCode blank for a new
            student, or fill it in (e.g. from &quot;Download editable copy&quot;) to update that
            student instead.
          </p>
          {importResult ? (
            <div className="text-sm">
              <p>
                {importResult.created} created, {importResult.updated} updated (of {importResult.totalRows} row(s)).
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
              <NativeSelect
                className="h-7 w-32"
                placeholder="Change status"
                value={studentStatusEdits[s.id] ?? ""}
                onChange={(v) => setStudentStatusEdits((f) => ({ ...f, [s.id]: v as StudentStatus }))}
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                  { value: "GRADUATED", label: "Graduated" },
                  { value: "TRANSFERRED", label: "Transferred" },
                  { value: "WITHDRAWN", label: "Withdrawn" },
                ].filter((o) => o.value !== s.status)}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7"
                disabled={!studentStatusEdits[s.id]}
                onClick={() =>
                  submitAction(
                    () =>
                      api.updateStudentStatus(s.id, {
                        status: studentStatusEdits[s.id],
                        effectiveDate: todayLocalDateString(),
                      }),
                    () => {
                      setStudentStatusEdits((f) => {
                        const next = { ...f };
                        delete next[s.id];
                        return next;
                      });
                      students.mutate();
                    },
                  )
                }
              >
                Update
              </Button>
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
                variant="outline"
                onClick={() => downloadBlob(() => api.getStudentIdCardPdf(s.id), `id-card-${s.studentCode}.pdf`)}
              >
                ID card
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
          userId: string | null;
          firstName: string;
          middleName: string | null;
          lastName: string;
          phone: string;
          email: string | null;
          photoUrl: string | null;
        }) => (
          <div id={`guardian-${g.id}`} className="rounded-md transition-shadow">
            <span className="flex items-center gap-2">
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
            {g.userId ? (
              <p className="text-muted-foreground mt-1 text-xs">
                Portal login: {guardianUsername(g.id)}
              </p>
            ) : (
              <form
                className="mt-2 flex items-end gap-2"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  handleCreateGuardianLogin(g.id);
                }}
              >
                <Input
                  type="password"
                  className="h-7 w-40"
                  placeholder="Set initial password"
                  value={guardianLoginPasswordForms[g.id] ?? ""}
                  onChange={(e) => setGuardianLoginPasswordForms((f) => ({ ...f, [g.id]: e.target.value }))}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  className="h-7"
                  disabled={(guardianLoginPasswordForms[g.id] ?? "").length < 8}
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
            <PersonPicker
              className="w-56"
              placeholder="Select student"
              value={linkForm.studentId}
              onChange={(v) => setLinkForm((f) => ({ ...f, studentId: v }))}
              options={(studentsPicker.data ?? []).map(studentToPersonOption)}
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
          section: { name: string } | null;
          semester: { name: string };
        }) => (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {en.student.firstName} {en.student.lastName}{" "}
              <span className="text-muted-foreground">({en.student.studentCode})</span> — {en.program.name}
              {en.section ? ` · ${en.section.name}` : ""} · {en.semester.name}
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
            <Label className="text-xs">Filter by semester</Label>
            <NativeSelect
              className="h-8 w-32"
              placeholder="All semesters"
              value={enrollmentFilters.semesterId}
              onChange={(v) => {
                setEnrollmentFilters((f) => ({ ...f, semesterId: v }));
                setEnrollmentsPage(1);
              }}
              options={(semesters.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
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
                  sectionId: enrollForm.sectionId || undefined,
                  semesterId: enrollForm.semesterId,
                  enrollmentDate: enrollForm.enrollmentDate,
                }),
              () => {
                setEnrollForm((f) => ({ ...f, programId: "", sectionId: "", semesterId: "", enrollmentDate: "" }));
                enrollments.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Student</Label>
            <PersonPicker
              className="w-56"
              placeholder="Select student"
              value={enrollForm.studentId}
              onChange={(v) => setEnrollForm((f) => ({ ...f, studentId: v }))}
              options={(studentsPicker.data ?? []).map(studentToPersonOption)}
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
            <Label>Semester</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select semester"
              value={enrollForm.semesterId}
              onChange={(v) => setEnrollForm((f) => ({ ...f, semesterId: v, sectionId: "" }))}
              options={(semesters.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Section (optional)</Label>
            <NativeSelect
              className="w-40"
              placeholder="None"
              value={enrollForm.sectionId}
              onChange={(v) => setEnrollForm((f) => ({ ...f, sectionId: v }))}
              // Filtered by the chosen Program/Semester above — previously
              // this listed every section in the org regardless of
              // what was picked (audit finding #09's own footnote).
              options={(sections.data ?? [])
                .filter(
                  (s) =>
                    (!enrollForm.programId || s.programId === enrollForm.programId) &&
                    (!enrollForm.semesterId || s.semesterId === enrollForm.semesterId),
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
            disabled={!enrollForm.studentId || !enrollForm.programId || !enrollForm.semesterId}
          >
            Enroll
          </Button>
        </form>
      </EntityCard>

      <EntityCard
        id="extracurricular-activities"
        title="Extra-curricular Activities"
        emptyLabel="No activities match these filters."
        items={activities.data?.data}
        footer={
          <>
            {activities.data ? (
              <ListPager
                page={activities.data.page}
                totalPages={activities.data.totalPages}
                onPrev={() => setActivitiesPage((p) => Math.max(1, p - 1))}
                onNext={() => setActivitiesPage((p) => p + 1)}
              />
            ) : null}
            {editingActivityId ? (
              <form
                className="flex flex-wrap items-end gap-3 border-b pb-4"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  submitAction(
                    () =>
                      api.updateExtracurricularActivity(editingActivityId, {
                        title: editActivityForm.title,
                        role: editActivityForm.role || undefined,
                        description: editActivityForm.description || undefined,
                        startDate: editActivityForm.startDate,
                        endDate: editActivityForm.endDate || undefined,
                      }),
                    () => {
                      setEditingActivityId(null);
                      activities.mutate();
                    },
                  );
                }}
              >
                <div className="space-y-2">
                  <Label>Title</Label>
                  <ActivityLookupSelect
                    className="w-40"
                    kind="ACTIVITY_TITLE"
                    placeholder="Select title"
                    value={editActivityForm.title}
                    onChange={(v) => setEditActivityForm((f) => ({ ...f, title: v }))}
                    options={(activityTitleLookups.data ?? []).map((l) => l.name)}
                    onCreated={() => activityTitleLookups.mutate()}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role (optional)</Label>
                  <ActivityLookupSelect
                    className="w-36"
                    kind="ACTIVITY_ROLE"
                    placeholder="Select role"
                    value={editActivityForm.role}
                    onChange={(v) => setEditActivityForm((f) => ({ ...f, role: v }))}
                    options={(activityRoleLookups.data ?? []).map((l) => l.name)}
                    onCreated={() => activityRoleLookups.mutate()}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Start date</Label>
                  <Input
                    required
                    type="date"
                    value={editActivityForm.startDate}
                    onChange={(e) => setEditActivityForm((f) => ({ ...f, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End date (optional)</Label>
                  <Input
                    type="date"
                    value={editActivityForm.endDate}
                    onChange={(e) => setEditActivityForm((f) => ({ ...f, endDate: e.target.value }))}
                  />
                </div>
                <div className="w-full space-y-2">
                  <Label>Description (optional)</Label>
                  <Textarea
                    value={editActivityForm.description}
                    onChange={(e) => setEditActivityForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <Button type="submit" size="sm" disabled={!editActivityForm.title || !editActivityForm.startDate}>
                  Save
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setEditingActivityId(null)}>
                  Cancel
                </Button>
              </form>
            ) : null}
          </>
        }
        renderItem={(a: {
          id: string;
          title: string;
          role: string | null;
          description: string | null;
          startDate: string;
          endDate: string | null;
          student: { firstName: string; lastName: string; studentCode: string };
        }) => (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span>
                {a.student.firstName} {a.student.lastName}{" "}
                <span className="text-muted-foreground">({a.student.studentCode})</span> — {a.title}
                {a.role ? ` · ${a.role}` : ""} ·{" "}
                {new Date(a.startDate).toLocaleDateString()} –{" "}
                {a.endDate ? new Date(a.endDate).toLocaleDateString() : "ongoing"}
              </span>
              {a.description ? <p className="text-muted-foreground text-xs">{a.description}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingActivityId(a.id);
                  setEditActivityForm({
                    title: a.title,
                    role: a.role ?? "",
                    description: a.description ?? "",
                    startDate: a.startDate.slice(0, 10),
                    endDate: a.endDate ? a.endDate.slice(0, 10) : "",
                  });
                }}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => submitDelete(() => api.deleteExtracurricularActivity(a.id), () => activities.mutate())}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      >
        <div className="flex flex-wrap items-end gap-3 pb-3">
          <div className="space-y-1">
            <Label className="text-xs">Filter by student</Label>
            <PersonPicker
              className="w-56"
              placeholder="All students"
              value={activityStudentFilter}
              onChange={(v) => {
                setActivityStudentFilter(v);
                setActivitiesPage(1);
              }}
              options={(studentsPicker.data ?? []).map(studentToPersonOption)}
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
                api.createStudentActivity(activityForm.studentId, {
                  title: activityForm.title,
                  role: activityForm.role || undefined,
                  description: activityForm.description || undefined,
                  startDate: activityForm.startDate,
                  endDate: activityForm.endDate || undefined,
                }),
              () => {
                setActivityForm((f) => ({ ...f, title: "", role: "", description: "", startDate: "", endDate: "" }));
                activities.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Student</Label>
            <PersonPicker
              className="w-56"
              placeholder="Select student"
              value={activityForm.studentId}
              onChange={(v) => setActivityForm((f) => ({ ...f, studentId: v }))}
              options={(studentsPicker.data ?? []).map(studentToPersonOption)}
            />
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <ActivityLookupSelect
              className="w-40"
              kind="ACTIVITY_TITLE"
              placeholder="Select title"
              value={activityForm.title}
              onChange={(v) => setActivityForm((f) => ({ ...f, title: v }))}
              options={(activityTitleLookups.data ?? []).map((l) => l.name)}
              onCreated={() => activityTitleLookups.mutate()}
            />
          </div>
          <div className="space-y-2">
            <Label>Role (optional)</Label>
            <ActivityLookupSelect
              className="w-36"
              kind="ACTIVITY_ROLE"
              placeholder="Select role"
              value={activityForm.role}
              onChange={(v) => setActivityForm((f) => ({ ...f, role: v }))}
              options={(activityRoleLookups.data ?? []).map((l) => l.name)}
              onCreated={() => activityRoleLookups.mutate()}
            />
          </div>
          <div className="space-y-2">
            <Label>Start date</Label>
            <Input
              required
              type="date"
              value={activityForm.startDate}
              onChange={(e) => setActivityForm((f) => ({ ...f, startDate: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>End date (optional)</Label>
            <Input
              type="date"
              value={activityForm.endDate}
              onChange={(e) => setActivityForm((f) => ({ ...f, endDate: e.target.value }))}
            />
          </div>
          <div className="w-full space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              value={activityForm.description}
              onChange={(e) => setActivityForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <Button type="submit" disabled={!activityForm.studentId || !activityForm.title || !activityForm.startDate}>
            Add
          </Button>
        </form>
      </EntityCard>

      <Card>
        <CardHeader>
          <CardTitle>Activity Catalogs</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <ActivityLookupManageList title="Titles" data={activityTitleLookups.data} mutate={() => activityTitleLookups.mutate()} />
          <ActivityLookupManageList title="Roles" data={activityRoleLookups.data} mutate={() => activityRoleLookups.mutate()} />
        </CardContent>
      </Card>
    </div>
  );
}
