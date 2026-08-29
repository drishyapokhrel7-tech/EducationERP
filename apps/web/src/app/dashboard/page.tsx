"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Building2, ClipboardList, GraduationCap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { StatCard } from "@/components/ui/stat-card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { OnboardingChecklist, type OnboardingStep } from "@/components/dashboard/onboarding-checklist";
import { api } from "@/lib/api";
import { submitAction, submitDelete } from "@/lib/submit-action";
import type { CampusType } from "@education-erp/api-client";

export default function DashboardPage() {
  const { data: organization } = useSWR("organization", () => api.getOwnOrganization());
  const campusesQuery = useSWR("campuses", () => api.listCampuses());
  const campuses = campusesQuery.data ?? [];
  const mutateCampuses = campusesQuery.mutate;
  // Only a count is shown (StatCard below) — fetch page 1 at the
  // smallest page size and read `.total` rather than pulling the whole
  // roster just to call `.length` on it (Phase 8 performance-
  // optimization slice).
  const { data: studentsPage } = useSWR("students-count", () => api.listStudents({ pageSize: 1 }));
  const { data: employeesPage } = useSWR("employees-count", () => api.listEmployees({ pageSize: 1 }));
  const { data: applications = [] } = useSWR("admission-applications", () =>
    api.listAdmissionApplications(),
  );
  // Getting-started checklist (UX audit finding) — driven entirely by
  // real counts, same SWR keys the pages that actually own each of
  // these already use, so a session that's visited them dedupes
  // instead of double-fetching. Every one of these lists is a small,
  // org-scoped catalog table (already fetched unbounded elsewhere in
  // this app) except enrollments, which reads its own `.total` the
  // same way the students/employees counts above do.
  //
  // Deliberately reading the raw (non-defaulted) `.data` here, not
  // `data = []` — this is the exact "still loading" vs "genuinely
  // empty" distinction the audit itself flagged for EntityCard (#06).
  // With 11 requests firing in parallel on every dashboard load, some
  // are still in flight for a moment; defaulting straight to `[]`
  // would count an unloaded step as "not done," which would even
  // flash this whole card into view on an org that's actually fully
  // set up, right before the last request resolves and it disappears.
  const facultiesQuery = useSWR("faculties", () => api.listFaculties());
  const departmentsQuery = useSWR("departments", () => api.listDepartments());
  const programsQuery = useSWR("programs", () => api.listPrograms());
  const academicYearsQuery = useSWR("academic-years", () => api.listAcademicYears());
  const termsQuery = useSWR("terms", () => api.listTerms());
  const sectionsQuery = useSWR("sections", () => api.listSections());
  const staffTypesQuery = useSWR("staff-types", () => api.listStaffTypes());
  const designationsQuery = useSWR("designations", () => api.listDesignations());
  const enrollmentsQuery = useSWR("enrollments-count", () => api.listAllEnrollments({ pageSize: 1 }));
  const feeCategoriesQuery = useSWR("fee-categories", () => api.listFeeCategories());
  const feeStructuresQuery = useSWR("fee-structures", () => api.listFeeStructures());

  const onboardingDataLoaded = [
    campusesQuery.data,
    studentsPage,
    employeesPage,
    facultiesQuery.data,
    departmentsQuery.data,
    programsQuery.data,
    academicYearsQuery.data,
    termsQuery.data,
    sectionsQuery.data,
    staffTypesQuery.data,
    designationsQuery.data,
    enrollmentsQuery.data,
    feeCategoriesQuery.data,
    feeStructuresQuery.data,
  ].every((d) => d !== undefined);

  const onboardingSteps: OnboardingStep[] = [
    { label: "Institution", done: campuses.length > 0 },
    { label: "Faculty", done: (facultiesQuery.data ?? []).length > 0, href: "/dashboard/org-structure#faculties" },
    {
      label: "Department",
      done: (departmentsQuery.data ?? []).length > 0,
      href: "/dashboard/org-structure#departments",
    },
    { label: "Program", done: (programsQuery.data ?? []).length > 0, href: "/dashboard/org-structure#programs" },
    {
      label: "Academic year",
      done: (academicYearsQuery.data ?? []).length > 0,
      href: "/dashboard/org-structure#academic-years",
    },
    { label: "Term", done: (termsQuery.data ?? []).length > 0, href: "/dashboard/org-structure#terms" },
    { label: "Section", done: (sectionsQuery.data ?? []).length > 0, href: "/dashboard/org-structure#sections" },
    { label: "Staff type", done: (staffTypesQuery.data ?? []).length > 0, href: "/dashboard/staff#staff-types" },
    {
      label: "Designation",
      done: (designationsQuery.data ?? []).length > 0,
      href: "/dashboard/staff#designations",
    },
    { label: "Employee", done: (employeesPage?.total ?? 0) > 0, href: "/dashboard/staff#employees" },
    { label: "Student", done: (studentsPage?.total ?? 0) > 0, href: "/dashboard/students#students" },
    {
      label: "Enrollment",
      done: (enrollmentsQuery.data?.total ?? 0) > 0,
      href: "/dashboard/students#enrollment",
    },
    {
      label: "Fee category",
      done: (feeCategoriesQuery.data ?? []).length > 0,
      href: "/dashboard/finance#fee-categories",
    },
    {
      label: "Fee structure",
      done: (feeStructuresQuery.data ?? []).length > 0,
      href: "/dashboard/finance#fee-structures",
    },
  ];
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", code: "" });
  const [editingCampusId, setEditingCampusId] = useState<string | null>(null);
  const [editCampusForm, setEditCampusForm] = useState<{ name: string; code: string; type: CampusType }>({
    name: "",
    code: "",
    type: "GENERIC",
  });
  // Deleting an Institution is the root of an entire org tree (for a
  // single-campus school, its only campus) — the one delete button on
  // this page that genuinely earns a confirm step, unlike the small
  // catalog-entity deletes elsewhere which already have a legible
  // dependency-guard error and no real "oops" risk.
  const [deletingCampus, setDeletingCampus] = useState<{ id: string; name: string } | null>(null);

  // A real, persisted Campus.type now backs this picker (previously a
  // client-only cosmetic label with no stored column — see the git
  // history for that former comment). Selecting "College" causes the
  // backend to seed a default Faculty/Department/Program structure
  // for this campus (see the API's college-structure-defaults.ts) —
  // every other option behaves exactly as before, a bare campus row.
  // GENERIC reads as "Other" here, deliberately NOT "Institution" —
  // "Institution" is the umbrella word covering every option in this
  // list (School, College, Montessori, ...), so listing it as one of
  // the choices read as circular/confusing. "Other" is the plain,
  // not-further-classified option; "Institution"/"Institutions" is
  // reserved for the page-level heading below, never a selectable type.
  const CAMPUS_TYPE_OPTIONS = [
    { value: "GENERIC", label: "Other" },
    { value: "SCHOOL", label: "School" },
    { value: "COLLEGE", label: "College" },
    { value: "MONTESSORI", label: "Montessori" },
  ] as const;
  const [campusType, setCampusType] = useState<(typeof CAMPUS_TYPE_OPTIONS)[number]["value"]>("GENERIC");
  // Only describes what's about to be added (the button text, toast
  // messages) — never the section heading/count below. Coupling those
  // to whichever type happens to be selected in the add-form was
  // itself the confusing bug: picking "College" here used to retitle
  // the whole list "Colleges" even with zero colleges actually
  // created. The list's own label is computed separately, below, from
  // the real data only. GENERIC reads as "Institution" here (not the
  // dropdown's own "Other" label) — "Add Institution"/"Institution
  // created" reads naturally as plain action copy, the circularity
  // problem only existed inside the type list itself.
  const campusTypeLabel = campusType === "GENERIC" ? "Institution" : CAMPUS_TYPE_OPTIONS.find((o) => o.value === campusType)!.label;
  const existingCampusLabel = campuses.length === 1 ? "Institution" : "Institutions";

  // Not every institution runs multiple campuses/schools — this
  // shortcut fills the campus form from the organization's own
  // already-validated name/slug (slug is @MinLength(2) at registration,
  // well over the campus code's @MinLength(1), so this always passes
  // validation) instead of making a single-site admin retype it.
  function onSingleInstitution() {
    if (!organization) return;
    setForm({ name: organization.name, code: organization.slug });
    toast.success("Okay No Problem Now you can click Add Institution button below to make this institution official.");
  }

  async function onCreateCampus(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const campus = await api.createCampus({ ...form, type: campusType });
      setForm({ name: "", code: "" });
      toast.success(
        campusType === "COLLEGE"
          ? "College created with a default Faculty/Department/Program structure — edit it anytime under Org Structure."
          : `${campusTypeLabel} created`,
      );
      mutateCampuses([...campuses, campus], { revalidate: false });
    } catch {
      toast.error(`Failed to create ${campusTypeLabel.toLowerCase()}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{organization?.name ?? "Loading…"}</h1>
        <p className="text-muted-foreground text-sm">
          Your organization&apos;s data is private — nothing here is visible to any other school on this platform.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label={existingCampusLabel} value={campuses.length} icon={<Building2 className="size-4" />} />
        <StatCard label="Students" value={studentsPage?.total ?? 0} icon={<GraduationCap className="size-4" />} />
        <StatCard label="Staff" value={employeesPage?.total ?? 0} icon={<Users className="size-4" />} />
        <StatCard
          label="Admissions"
          value={applications.length}
          icon={<ClipboardList className="size-4" />}
        />
      </div>

      {onboardingDataLoaded ? <OnboardingChecklist steps={onboardingSteps} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>{existingCampusLabel}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {campuses.length === 0 ? (
            <p className="text-muted-foreground text-sm">No institutions yet.</p>
          ) : (
            <ul className="divide-y">
              {campuses.map((campus) => (
                <li key={campus.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    {campus.name} <span className="text-muted-foreground">{campus.code}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingCampusId(campus.id);
                        setEditCampusForm({ name: campus.name, code: campus.code, type: campus.type });
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeletingCampus({ id: campus.id, name: campus.name })}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {editingCampusId ? (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                submitAction(
                  () => api.updateCampus(editingCampusId, editCampusForm),
                  () => {
                    setEditingCampusId(null);
                    mutateCampuses();
                  },
                );
              }}
            >
              <div className="space-y-2">
                <Label>Type</Label>
                <NativeSelect
                  className="w-32"
                  placeholder="Select type"
                  value={editCampusForm.type}
                  onChange={(v) => setEditCampusForm((f) => ({ ...f, type: v as CampusType }))}
                  options={CAMPUS_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  required
                  value={editCampusForm.name}
                  onChange={(e) => setEditCampusForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  required
                  className="w-24"
                  value={editCampusForm.code}
                  onChange={(e) => setEditCampusForm((f) => ({ ...f, code: e.target.value }))}
                />
              </div>
              <Button type="submit" size="sm">
                Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingCampusId(null)}>
                Cancel
              </Button>
            </form>
          ) : null}

          <Separator />

          {campuses.length === 0 ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs">
                Only one {campusTypeLabel.toLowerCase()}? Skip typing it in yourself.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={onSingleInstitution} disabled={!organization}>
                I have only one institution
              </Button>
            </div>
          ) : null}

          <form onSubmit={onCreateCampus} className="flex items-end gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <NativeSelect
                className="w-32"
                placeholder="Select type"
                value={campusType}
                onChange={(v) => setCampusType(v as (typeof CAMPUS_TYPE_OPTIONS)[number]["value"])}
                options={CAMPUS_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campus-name">Name</Label>
              <Input
                id="campus-name"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campus-code">Code</Label>
              <Input
                id="campus-code"
                required
                className="w-24"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              />
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? "Adding…" : `Add ${campusTypeLabel}`}
            </Button>
          </form>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deletingCampus !== null}
        onOpenChange={(open) => !open && setDeletingCampus(null)}
        title={`Delete ${deletingCampus?.name}?`}
        description="This removes the institution and everything underneath it — faculties, departments, programs, sections. If any of those are still referenced elsewhere, the delete is blocked instead."
        confirmLabel="Delete institution"
        variant="destructive"
        onConfirm={() => {
          if (!deletingCampus) return;
          return submitDelete(() => api.deleteCampus(deletingCampus.id), () => mutateCampuses());
        }}
      />
    </div>
  );
}
