"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { EntityCard } from "@/components/dashboard/entity-card";
import { PageSubNav } from "@/components/dashboard/page-subnav";
import { api } from "@/lib/api";
import { submitAction, submitDelete } from "@/lib/submit-action";

// Shown under a disabled "Add" submit so the missing prerequisite is
// visible instead of the button just silently refusing to do anything.
function RequiredHint({ text }: { text: string }) {
  return <p className="text-muted-foreground text-xs">{text}</p>;
}

export default function OrgStructurePage() {
  const campuses = useSWR("campuses", () => api.listCampuses());
  const faculties = useSWR("faculties", () => api.listFaculties());
  const departments = useSWR("departments", () => api.listDepartments());
  const programs = useSWR("programs", () => api.listPrograms());
  const academicYears = useSWR("academic-years", () => api.listAcademicYears());
  const terms = useSWR("terms", () => api.listTerms());
  const sections = useSWR("sections", () => api.listSections());

  const [facultyForm, setFacultyForm] = useState({ campusId: "", name: "", code: "" });
  const [departmentForm, setDepartmentForm] = useState({ facultyId: "", name: "", code: "" });
  const [programForm, setProgramForm] = useState({
    departmentId: "",
    name: "",
    code: "",
    level: "",
    durationSemesters: "",
    creditHours: "",
    entranceExam: "",
  });
  const [yearForm, setYearForm] = useState({ name: "", startDate: "", endDate: "" });
  const [termForm, setTermForm] = useState({
    academicYearId: "",
    name: "",
    code: "",
    sequence: "1",
    startDate: "",
    endDate: "",
  });
  const [sectionForm, setSectionForm] = useState({
    programId: "",
    termId: "",
    name: "",
    code: "",
    capacity: "",
  });

  // Edit state, one per catalog entity on this page — a separate,
  // small inline form (rendered via EntityCard's `footer`) rather
  // than merging into the always-visible create form above.
  const [editingFacultyId, setEditingFacultyId] = useState<string | null>(null);
  const [editFacultyForm, setEditFacultyForm] = useState({ campusId: "", name: "", code: "" });
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null);
  const [editDepartmentForm, setEditDepartmentForm] = useState({ facultyId: "", name: "", code: "" });
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [editProgramForm, setEditProgramForm] = useState({
    departmentId: "",
    name: "",
    code: "",
    level: "",
    durationSemesters: "",
    creditHours: "",
    entranceExam: "",
  });
  const [editingYearId, setEditingYearId] = useState<string | null>(null);
  const [editYearForm, setEditYearForm] = useState({ name: "", startDate: "", endDate: "" });
  const [editingTermId, setEditingTermId] = useState<string | null>(null);
  const [editTermForm, setEditTermForm] = useState({
    academicYearId: "",
    name: "",
    code: "",
    sequence: "1",
    startDate: "",
    endDate: "",
  });
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editSectionForm, setEditSectionForm] = useState({
    programId: "",
    termId: "",
    name: "",
    code: "",
    capacity: "",
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Organization structure</h1>
        <p className="text-muted-foreground text-sm">
          Faculty → Department → Program, and Academic Year → Term → Section — the hierarchy
          everything else (staff, students, courses) attaches to.
        </p>
      </div>

      <PageSubNav
        sections={[
          { id: "faculties", label: "Faculties" },
          { id: "departments", label: "Departments" },
          { id: "programs", label: "Programs" },
          { id: "academic-years", label: "Academic years" },
          { id: "terms", label: "Terms" },
          { id: "sections", label: "Sections" },
        ]}
      />

      <EntityCard
        id="faculties"
        title="Faculties"
        emptyLabel="No faculties yet."
        items={faculties.data}
        renderItem={(f: { id: string; campusId: string; name: string; code: string }) => (
          <div className="flex items-center justify-between gap-2">
            <span>
              {f.name} <span className="text-muted-foreground">{f.code}</span>
              <span className="text-muted-foreground">
                {" "}
                · {campuses.data?.find((c) => c.id === f.campusId)?.name ?? "Unknown institution"}
              </span>
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingFacultyId(f.id);
                  setEditFacultyForm({ campusId: f.campusId, name: f.name, code: f.code });
                }}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => submitDelete(() => api.deleteFaculty(f.id), () => faculties.mutate())}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
        footer={
          editingFacultyId ? (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                submitAction(
                  () => api.updateFaculty(editingFacultyId, editFacultyForm),
                  () => {
                    setEditingFacultyId(null);
                    faculties.mutate();
                  },
                );
              }}
            >
              <div className="space-y-2">
                <Label>Institution</Label>
                <NativeSelect
                  className="w-40"
                  placeholder="Select institution"
                  value={editFacultyForm.campusId}
                  onChange={(v) => setEditFacultyForm((f) => ({ ...f, campusId: v }))}
                  options={(campuses.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  required
                  value={editFacultyForm.name}
                  onChange={(e) => setEditFacultyForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  required
                  className="w-24"
                  value={editFacultyForm.code}
                  onChange={(e) => setEditFacultyForm((f) => ({ ...f, code: e.target.value }))}
                />
              </div>
              <Button type="submit" size="sm">
                Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingFacultyId(null)}>
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
              () => api.createFaculty(facultyForm),
              () => {
                setFacultyForm({ campusId: "", name: "", code: "" });
                faculties.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Institution (required)</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select institution"
              value={facultyForm.campusId}
              onChange={(v) => setFacultyForm((f) => ({ ...f, campusId: v }))}
              options={(campuses.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              required
              placeholder="e.g. Faculty of Science"
              title="A broad academic division (e.g. Faculty of Science, Faculty of Management) that Departments and Programs belong to."
              value={facultyForm.name}
              onChange={(e) => setFacultyForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Code</Label>
            <Input
              required
              className="w-24"
              value={facultyForm.code}
              onChange={(e) => setFacultyForm((f) => ({ ...f, code: e.target.value }))}
            />
          </div>
          <div className="flex flex-col items-start gap-1">
            <Button type="submit" disabled={!facultyForm.campusId}>
              Add
            </Button>
            {!facultyForm.campusId ? <RequiredHint text="Select an institution first." /> : null}
          </div>
        </form>
      </EntityCard>

      <EntityCard
        id="departments"
        title="Departments"
        emptyLabel="No departments yet."
        items={departments.data}
        renderItem={(d: { id: string; facultyId: string; name: string; code: string }) => (
          <div className="flex items-center justify-between gap-2">
            <span>
              {d.name} <span className="text-muted-foreground">{d.code}</span>
              <span className="text-muted-foreground">
                {" "}
                · {faculties.data?.find((f) => f.id === d.facultyId)?.name ?? "Unknown faculty"}
              </span>
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingDepartmentId(d.id);
                  setEditDepartmentForm({ facultyId: d.facultyId, name: d.name, code: d.code });
                }}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => submitDelete(() => api.deleteDepartment(d.id), () => departments.mutate())}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
        footer={
          editingDepartmentId ? (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                submitAction(
                  () => api.updateDepartment(editingDepartmentId, editDepartmentForm),
                  () => {
                    setEditingDepartmentId(null);
                    departments.mutate();
                  },
                );
              }}
            >
              <div className="space-y-2">
                <Label>Faculty</Label>
                <NativeSelect
                  className="w-40"
                  placeholder="Select faculty"
                  value={editDepartmentForm.facultyId}
                  onChange={(v) => setEditDepartmentForm((f) => ({ ...f, facultyId: v }))}
                  options={(faculties.data ?? []).map((f) => ({ value: f.id, label: f.name }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  required
                  value={editDepartmentForm.name}
                  onChange={(e) => setEditDepartmentForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  required
                  className="w-24"
                  value={editDepartmentForm.code}
                  onChange={(e) => setEditDepartmentForm((f) => ({ ...f, code: e.target.value }))}
                />
              </div>
              <Button type="submit" size="sm">
                Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingDepartmentId(null)}>
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
              () => api.createDepartment(departmentForm),
              () => {
                setDepartmentForm({ facultyId: "", name: "", code: "" });
                departments.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Faculty (required)</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select faculty"
              value={departmentForm.facultyId}
              onChange={(v) => setDepartmentForm((f) => ({ ...f, facultyId: v }))}
              options={(faculties.data ?? []).map((f) => ({ value: f.id, label: f.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              required
              value={departmentForm.name}
              onChange={(e) => setDepartmentForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Code</Label>
            <Input
              required
              className="w-24"
              value={departmentForm.code}
              onChange={(e) => setDepartmentForm((f) => ({ ...f, code: e.target.value }))}
            />
          </div>
          <div className="flex flex-col items-start gap-1">
            <Button type="submit" disabled={!departmentForm.facultyId}>
              Add
            </Button>
            {!departmentForm.facultyId ? <RequiredHint text="Select a faculty first." /> : null}
          </div>
        </form>
      </EntityCard>

      <EntityCard
        id="programs"
        title="Programs"
        emptyLabel="No programs yet."
        items={programs.data}
        renderItem={(p: {
          id: string;
          departmentId: string;
          name: string;
          code: string;
          level: string | null;
          durationSemesters: number | null;
          creditHours: number | null;
          entranceExam: string | null;
        }) => (
          <div className="flex items-center justify-between gap-2">
            <span>
              {p.name} <span className="text-muted-foreground">{p.code}</span>
              {p.level ? <span className="text-muted-foreground"> · {p.level}</span> : null}
              {p.durationSemesters ? (
                <span className="text-muted-foreground"> · {p.durationSemesters} sem</span>
              ) : null}
              {p.creditHours ? (
                <span className="text-muted-foreground"> · {p.creditHours} credit hrs</span>
              ) : null}
              {p.entranceExam ? (
                <span className="text-muted-foreground"> · {p.entranceExam} entrance</span>
              ) : null}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingProgramId(p.id);
                  setEditProgramForm({
                    departmentId: p.departmentId,
                    name: p.name,
                    code: p.code,
                    level: p.level ?? "",
                    durationSemesters: p.durationSemesters != null ? String(p.durationSemesters) : "",
                    creditHours: p.creditHours != null ? String(p.creditHours) : "",
                    entranceExam: p.entranceExam ?? "",
                  });
                }}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => submitDelete(() => api.deleteProgram(p.id), () => programs.mutate())}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
        footer={
          editingProgramId ? (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                submitAction(
                  () =>
                    api.updateProgram(editingProgramId, {
                      departmentId: editProgramForm.departmentId,
                      name: editProgramForm.name,
                      code: editProgramForm.code,
                      level: editProgramForm.level || undefined,
                      durationSemesters: editProgramForm.durationSemesters
                        ? Number(editProgramForm.durationSemesters)
                        : undefined,
                      creditHours: editProgramForm.creditHours ? Number(editProgramForm.creditHours) : undefined,
                      entranceExam: editProgramForm.entranceExam || undefined,
                    }),
                  () => {
                    setEditingProgramId(null);
                    programs.mutate();
                  },
                );
              }}
            >
              <div className="space-y-2">
                <Label>Department</Label>
                <NativeSelect
                  className="w-40"
                  placeholder="Select department"
                  value={editProgramForm.departmentId}
                  onChange={(v) => setEditProgramForm((f) => ({ ...f, departmentId: v }))}
                  options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  required
                  value={editProgramForm.name}
                  onChange={(e) => setEditProgramForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  required
                  className="w-24"
                  value={editProgramForm.code}
                  onChange={(e) => setEditProgramForm((f) => ({ ...f, code: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Level (optional)</Label>
                <Input
                  placeholder="e.g. Grade 10, BSc"
                  value={editProgramForm.level}
                  onChange={(e) => setEditProgramForm((f) => ({ ...f, level: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Duration in semesters (optional)</Label>
                <Input
                  type="number"
                  min="0"
                  className="w-28"
                  value={editProgramForm.durationSemesters}
                  onChange={(e) => setEditProgramForm((f) => ({ ...f, durationSemesters: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Credit hours (optional)</Label>
                <Input
                  type="number"
                  min="0"
                  className="w-28"
                  value={editProgramForm.creditHours}
                  onChange={(e) => setEditProgramForm((f) => ({ ...f, creditHours: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Entrance exam (optional)</Label>
                <Input
                  placeholder="e.g. IOST, CMAT, None"
                  className="w-32"
                  value={editProgramForm.entranceExam}
                  onChange={(e) => setEditProgramForm((f) => ({ ...f, entranceExam: e.target.value }))}
                />
              </div>
              <Button type="submit" size="sm">
                Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingProgramId(null)}>
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
                api.createProgram({
                  departmentId: programForm.departmentId,
                  name: programForm.name,
                  code: programForm.code,
                  level: programForm.level || undefined,
                  durationSemesters: programForm.durationSemesters ? Number(programForm.durationSemesters) : undefined,
                  creditHours: programForm.creditHours ? Number(programForm.creditHours) : undefined,
                  entranceExam: programForm.entranceExam || undefined,
                }),
              () => {
                setProgramForm({
                  departmentId: "",
                  name: "",
                  code: "",
                  level: "",
                  durationSemesters: "",
                  creditHours: "",
                  entranceExam: "",
                });
                programs.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Department (required)</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select department"
              value={programForm.departmentId}
              onChange={(v) => setProgramForm((f) => ({ ...f, departmentId: v }))}
              options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              required
              value={programForm.name}
              onChange={(e) => setProgramForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Code</Label>
            <Input
              required
              className="w-24"
              value={programForm.code}
              onChange={(e) => setProgramForm((f) => ({ ...f, code: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Level (optional)</Label>
            <Input
              placeholder="e.g. Grade 10, BSc"
              value={programForm.level}
              onChange={(e) => setProgramForm((f) => ({ ...f, level: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Duration in semesters (optional)</Label>
            <Input
              type="number"
              min="0"
              className="w-28"
              value={programForm.durationSemesters}
              onChange={(e) => setProgramForm((f) => ({ ...f, durationSemesters: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Credit hours (optional)</Label>
            <Input
              type="number"
              min="0"
              className="w-28"
              value={programForm.creditHours}
              onChange={(e) => setProgramForm((f) => ({ ...f, creditHours: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Entrance exam (optional)</Label>
            <Input
              placeholder="e.g. IOST, CMAT, None"
              className="w-32"
              value={programForm.entranceExam}
              onChange={(e) => setProgramForm((f) => ({ ...f, entranceExam: e.target.value }))}
            />
          </div>
          <div className="flex flex-col items-start gap-1">
            <Button type="submit" disabled={!programForm.departmentId}>
              Add
            </Button>
            {!programForm.departmentId ? <RequiredHint text="Select a department first." /> : null}
          </div>
        </form>
      </EntityCard>

      <EntityCard
        id="academic-years"
        title="Academic years"
        emptyLabel="No academic years yet."
        items={academicYears.data}
        renderItem={(y: { id: string; name: string; startDate: string; endDate: string }) => (
          <div className="flex items-center justify-between gap-2">
            <span>
              {y.name}{" "}
              <span className="text-muted-foreground">
                {y.startDate.slice(0, 10)} – {y.endDate.slice(0, 10)}
              </span>
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingYearId(y.id);
                  setEditYearForm({
                    name: y.name,
                    startDate: y.startDate.slice(0, 10),
                    endDate: y.endDate.slice(0, 10),
                  });
                }}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => submitDelete(() => api.deleteAcademicYear(y.id), () => academicYears.mutate())}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
        footer={
          editingYearId ? (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                submitAction(
                  () => api.updateAcademicYear(editingYearId, editYearForm),
                  () => {
                    setEditingYearId(null);
                    academicYears.mutate();
                  },
                );
              }}
            >
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  required
                  value={editYearForm.name}
                  onChange={(e) => setEditYearForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Start date</Label>
                <Input
                  required
                  type="date"
                  value={editYearForm.startDate}
                  onChange={(e) => setEditYearForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>End date</Label>
                <Input
                  required
                  type="date"
                  value={editYearForm.endDate}
                  onChange={(e) => setEditYearForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
              <Button type="submit" size="sm">
                Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingYearId(null)}>
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
              () => api.createAcademicYear(yearForm),
              () => {
                setYearForm({ name: "", startDate: "", endDate: "" });
                academicYears.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              required
              placeholder="2026-2027"
              value={yearForm.name}
              onChange={(e) => setYearForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Start date</Label>
            <Input
              required
              type="date"
              value={yearForm.startDate}
              onChange={(e) => setYearForm((f) => ({ ...f, startDate: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>End date</Label>
            <Input
              required
              type="date"
              value={yearForm.endDate}
              onChange={(e) => setYearForm((f) => ({ ...f, endDate: e.target.value }))}
            />
          </div>
          <Button type="submit">Add</Button>
        </form>
      </EntityCard>

      <EntityCard
        id="terms"
        title="Terms"
        emptyLabel="No terms yet."
        items={terms.data}
        renderItem={(t: {
          id: string;
          academicYearId: string;
          name: string;
          code: string;
          sequence: number;
          startDate: string;
          endDate: string;
        }) => (
          <div className="flex items-center justify-between gap-2">
            <span>
              {t.sequence}. {t.name} <span className="text-muted-foreground">{t.code}</span>
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingTermId(t.id);
                  setEditTermForm({
                    academicYearId: t.academicYearId,
                    name: t.name,
                    code: t.code,
                    sequence: String(t.sequence),
                    startDate: t.startDate.slice(0, 10),
                    endDate: t.endDate.slice(0, 10),
                  });
                }}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => submitDelete(() => api.deleteTerm(t.id), () => terms.mutate())}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
        footer={
          editingTermId ? (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                submitAction(
                  () =>
                    api.updateTerm(editingTermId, {
                      ...editTermForm,
                      sequence: Number(editTermForm.sequence),
                    }),
                  () => {
                    setEditingTermId(null);
                    terms.mutate();
                  },
                );
              }}
            >
              <div className="space-y-2">
                <Label>Academic year</Label>
                <NativeSelect
                  className="w-40"
                  placeholder="Select year"
                  value={editTermForm.academicYearId}
                  onChange={(v) => setEditTermForm((f) => ({ ...f, academicYearId: v }))}
                  options={(academicYears.data ?? []).map((y) => ({ value: y.id, label: y.name }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  required
                  value={editTermForm.name}
                  onChange={(e) => setEditTermForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  required
                  className="w-20"
                  value={editTermForm.code}
                  onChange={(e) => setEditTermForm((f) => ({ ...f, code: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Sequence</Label>
                <Input
                  required
                  type="number"
                  min={1}
                  className="w-20"
                  value={editTermForm.sequence}
                  onChange={(e) => setEditTermForm((f) => ({ ...f, sequence: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Start date</Label>
                <Input
                  required
                  type="date"
                  value={editTermForm.startDate}
                  onChange={(e) => setEditTermForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>End date</Label>
                <Input
                  required
                  type="date"
                  value={editTermForm.endDate}
                  onChange={(e) => setEditTermForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
              <Button type="submit" size="sm">
                Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingTermId(null)}>
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
              () => api.createTerm({ ...termForm, sequence: Number(termForm.sequence) }),
              () => {
                setTermForm({
                  academicYearId: "",
                  name: "",
                  code: "",
                  sequence: "1",
                  startDate: "",
                  endDate: "",
                });
                terms.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Academic year (required)</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select year"
              value={termForm.academicYearId}
              onChange={(v) => setTermForm((f) => ({ ...f, academicYearId: v }))}
              options={(academicYears.data ?? []).map((y) => ({ value: y.id, label: y.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              required
              placeholder="Term 1"
              value={termForm.name}
              onChange={(e) => setTermForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Code</Label>
            <Input
              required
              className="w-20"
              value={termForm.code}
              onChange={(e) => setTermForm((f) => ({ ...f, code: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Sequence</Label>
            <Input
              required
              type="number"
              min={1}
              className="w-20"
              value={termForm.sequence}
              onChange={(e) => setTermForm((f) => ({ ...f, sequence: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Start date</Label>
            <Input
              required
              type="date"
              value={termForm.startDate}
              onChange={(e) => setTermForm((f) => ({ ...f, startDate: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>End date</Label>
            <Input
              required
              type="date"
              value={termForm.endDate}
              onChange={(e) => setTermForm((f) => ({ ...f, endDate: e.target.value }))}
            />
          </div>
          <div className="flex flex-col items-start gap-1">
            <Button type="submit" disabled={!termForm.academicYearId}>
              Add
            </Button>
            {!termForm.academicYearId ? <RequiredHint text="Select an academic year first." /> : null}
          </div>
        </form>
      </EntityCard>

      <EntityCard
        id="sections"
        title="Sections"
        emptyLabel="No sections yet."
        items={sections.data}
        renderItem={(s: {
          id: string;
          programId: string;
          termId: string;
          name: string;
          code: string;
          capacity: number | null;
        }) => (
          <div className="flex items-center justify-between gap-2">
            <span>
              {s.name} <span className="text-muted-foreground">{s.code}</span>
              <span className="text-muted-foreground">
                {" "}
                · {programs.data?.find((p) => p.id === s.programId)?.name ?? "Unknown program"} ·{" "}
                {terms.data?.find((t) => t.id === s.termId)?.name ?? "Unknown term"}
              </span>
              {s.capacity ? (
                <span className="text-muted-foreground"> · capacity {s.capacity}</span>
              ) : null}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingSectionId(s.id);
                  setEditSectionForm({
                    programId: s.programId,
                    termId: s.termId,
                    name: s.name,
                    code: s.code,
                    capacity: s.capacity ? String(s.capacity) : "",
                  });
                }}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => submitDelete(() => api.deleteSection(s.id), () => sections.mutate())}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
        footer={
          editingSectionId ? (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                submitAction(
                  () =>
                    api.updateSection(editingSectionId, {
                      ...editSectionForm,
                      capacity: editSectionForm.capacity ? Number(editSectionForm.capacity) : undefined,
                    }),
                  () => {
                    setEditingSectionId(null);
                    sections.mutate();
                  },
                );
              }}
            >
              <div className="space-y-2">
                <Label>Program</Label>
                <NativeSelect
                  className="w-40"
                  placeholder="Select program"
                  value={editSectionForm.programId}
                  onChange={(v) => setEditSectionForm((f) => ({ ...f, programId: v }))}
                  options={(programs.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Term</Label>
                <NativeSelect
                  className="w-40"
                  placeholder="Select term"
                  value={editSectionForm.termId}
                  onChange={(v) => setEditSectionForm((f) => ({ ...f, termId: v }))}
                  options={(terms.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  required
                  value={editSectionForm.name}
                  onChange={(e) => setEditSectionForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  required
                  className="w-20"
                  value={editSectionForm.code}
                  onChange={(e) => setEditSectionForm((f) => ({ ...f, code: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Capacity (optional)</Label>
                <Input
                  type="number"
                  min={1}
                  className="w-24"
                  value={editSectionForm.capacity}
                  onChange={(e) => setEditSectionForm((f) => ({ ...f, capacity: e.target.value }))}
                />
              </div>
              <Button type="submit" size="sm">
                Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingSectionId(null)}>
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
                api.createSection({
                  ...sectionForm,
                  capacity: sectionForm.capacity ? Number(sectionForm.capacity) : undefined,
                }),
              () => {
                setSectionForm({ programId: "", termId: "", name: "", code: "", capacity: "" });
                sections.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Program (required)</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select program"
              value={sectionForm.programId}
              onChange={(v) => setSectionForm((f) => ({ ...f, programId: v }))}
              options={(programs.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Term (required)</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select term"
              value={sectionForm.termId}
              onChange={(v) => setSectionForm((f) => ({ ...f, termId: v }))}
              options={(terms.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              required
              value={sectionForm.name}
              onChange={(e) => setSectionForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Code</Label>
            <Input
              required
              className="w-20"
              value={sectionForm.code}
              onChange={(e) => setSectionForm((f) => ({ ...f, code: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Capacity (optional)</Label>
            <Input
              type="number"
              min={1}
              className="w-24"
              value={sectionForm.capacity}
              onChange={(e) => setSectionForm((f) => ({ ...f, capacity: e.target.value }))}
            />
          </div>
          <div className="flex flex-col items-start gap-1">
            <Button type="submit" disabled={!sectionForm.programId || !sectionForm.termId}>
              Add
            </Button>
            {!sectionForm.programId || !sectionForm.termId ? (
              <RequiredHint
                text={`Select a ${[!sectionForm.programId ? "program" : null, !sectionForm.termId ? "term" : null].filter(Boolean).join(" and ")} first.`}
              />
            ) : null}
          </div>
        </form>
      </EntityCard>
    </div>
  );
}
