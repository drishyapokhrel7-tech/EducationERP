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
import { api } from "@/lib/api";
import { submitAction } from "@/lib/submit-action";
import type { CampusType } from "@education-erp/api-client";

export default function DashboardPage() {
  const { data: organization } = useSWR("organization", () => api.getOwnOrganization());
  const { data: campuses = [], mutate: mutateCampuses } = useSWR("campuses", () =>
    api.listCampuses(),
  );
  // Only a count is shown (StatCard below) — fetch page 1 at the
  // smallest page size and read `.total` rather than pulling the whole
  // roster just to call `.length` on it (Phase 8 performance-
  // optimization slice).
  const { data: studentsPage } = useSWR("students-count", () => api.listStudents({ pageSize: 1 }));
  const { data: employeesPage } = useSWR("employees-count", () => api.listEmployees({ pageSize: 1 }));
  const { data: applications = [] } = useSWR("admission-applications", () =>
    api.listAdmissionApplications(),
  );
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", code: "" });
  const [editingCampusId, setEditingCampusId] = useState<string | null>(null);
  const [editCampusForm, setEditCampusForm] = useState<{ name: string; code: string; type: CampusType }>({
    name: "",
    code: "",
    type: "GENERIC",
  });

  // A real, persisted Campus.type now backs this picker (previously a
  // client-only cosmetic label with no stored column — see the git
  // history for that former comment). Selecting "College" causes the
  // backend to seed a default Faculty/Department/Program structure
  // for this campus (see the API's college-structure-defaults.ts) —
  // every other option behaves exactly as before, a bare campus row.
  // GENERIC reads as "Institution" (not "Campus") in the UI — the
  // Campus model/API/route names are unchanged, this is display copy
  // only, same distinction as the School/College/Montessori options
  // below being UI labels over the same underlying Campus row.
  const CAMPUS_TYPE_OPTIONS = [
    { value: "GENERIC", label: "Institution" },
    { value: "SCHOOL", label: "School" },
    { value: "COLLEGE", label: "College" },
    { value: "MONTESSORI", label: "Montessori" },
  ] as const;
  const [campusType, setCampusType] = useState<(typeof CAMPUS_TYPE_OPTIONS)[number]["value"]>("GENERIC");
  const campusTypeLabel = CAMPUS_TYPE_OPTIONS.find((o) => o.value === campusType)?.label ?? "Institution";
  const campusTypePlural = `${campusTypeLabel}s`;
  // Once exactly one campus exists, that's a real, known fact — call
  // it "School" rather than the generic "Institution"/"Institutions"
  // label, regardless of whatever type is currently selected in the
  // add-form below (which is about what to add *next*, a separate
  // concern). At 0 or 2+ campuses there's no single right label to
  // infer, so this falls back to the existing add-form-driven label.
  const existingCampusLabel = campuses.length === 1 ? "School" : campusTypePlural;

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
          Phase 1 foundation — institutions below are scoped to your organization by both the API
          and Postgres row-level security.
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

      <Card>
        <CardHeader>
          <CardTitle>{existingCampusLabel}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {campuses.length === 0 ? (
            <p className="text-muted-foreground text-sm">No {campusTypePlural.toLowerCase()} yet.</p>
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
                      onClick={() => submitAction(() => api.deleteCampus(campus.id), () => mutateCampuses())}
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
    </div>
  );
}
