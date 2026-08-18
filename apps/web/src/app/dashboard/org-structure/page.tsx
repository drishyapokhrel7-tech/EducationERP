"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";

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
  const [programForm, setProgramForm] = useState({ departmentId: "", name: "", code: "", level: "" });
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

  async function submit(action: () => Promise<unknown>, onSuccess: () => void) {
    try {
      await action();
      onSuccess();
      toast.success("Created");
    } catch {
      toast.error("Failed to create — check that required fields are selected");
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Organization structure</h1>
        <p className="text-muted-foreground text-sm">
          Faculty → Department → Program, and Academic Year → Term → Section — the hierarchy
          everything else (staff, students, courses) attaches to.
        </p>
      </div>

      <EntityCard
        title="Faculties"
        emptyLabel="No faculties yet."
        items={faculties.data}
        renderItem={(f: { name: string; code: string }) => (
          <span>
            {f.name} <span className="text-muted-foreground">{f.code}</span>
          </span>
        )}
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(
              () => api.createFaculty(facultyForm),
              () => {
                setFacultyForm({ campusId: "", name: "", code: "" });
                faculties.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Campus</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select campus"
              value={facultyForm.campusId}
              onChange={(v) => setFacultyForm((f) => ({ ...f, campusId: v }))}
              options={(campuses.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              required
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
          <Button type="submit" disabled={!facultyForm.campusId}>
            Add
          </Button>
        </form>
      </EntityCard>

      <EntityCard
        title="Departments"
        emptyLabel="No departments yet."
        items={departments.data}
        renderItem={(d: { name: string; code: string }) => (
          <span>
            {d.name} <span className="text-muted-foreground">{d.code}</span>
          </span>
        )}
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(
              () => api.createDepartment(departmentForm),
              () => {
                setDepartmentForm({ facultyId: "", name: "", code: "" });
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
          <Button type="submit" disabled={!departmentForm.facultyId}>
            Add
          </Button>
        </form>
      </EntityCard>

      <EntityCard
        title="Programs"
        emptyLabel="No programs yet."
        items={programs.data}
        renderItem={(p: { name: string; code: string; level: string | null }) => (
          <span>
            {p.name} <span className="text-muted-foreground">{p.code}</span>
            {p.level ? <span className="text-muted-foreground"> · {p.level}</span> : null}
          </span>
        )}
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(
              () =>
                api.createProgram({
                  ...programForm,
                  level: programForm.level || undefined,
                }),
              () => {
                setProgramForm({ departmentId: "", name: "", code: "", level: "" });
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
          <Button type="submit" disabled={!programForm.departmentId}>
            Add
          </Button>
        </form>
      </EntityCard>

      <EntityCard
        title="Academic years"
        emptyLabel="No academic years yet."
        items={academicYears.data}
        renderItem={(y: { name: string; startDate: string; endDate: string }) => (
          <span>
            {y.name}{" "}
            <span className="text-muted-foreground">
              {y.startDate.slice(0, 10)} – {y.endDate.slice(0, 10)}
            </span>
          </span>
        )}
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(
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
        title="Terms"
        emptyLabel="No terms yet."
        items={terms.data}
        renderItem={(t: { name: string; code: string; sequence: number }) => (
          <span>
            {t.sequence}. {t.name} <span className="text-muted-foreground">{t.code}</span>
          </span>
        )}
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(
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
            <Label>Academic year</Label>
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
          <Button type="submit" disabled={!termForm.academicYearId}>
            Add
          </Button>
        </form>
      </EntityCard>

      <EntityCard
        title="Sections"
        emptyLabel="No sections yet."
        items={sections.data}
        renderItem={(s: { name: string; code: string; capacity: number | null }) => (
          <span>
            {s.name} <span className="text-muted-foreground">{s.code}</span>
            {s.capacity ? (
              <span className="text-muted-foreground"> · capacity {s.capacity}</span>
            ) : null}
          </span>
        )}
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(
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
            <Label>Program</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select program"
              value={sectionForm.programId}
              onChange={(v) => setSectionForm((f) => ({ ...f, programId: v }))}
              options={(programs.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Term</Label>
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
          <Button type="submit" disabled={!sectionForm.programId || !sectionForm.termId}>
            Add
          </Button>
        </form>
      </EntityCard>
    </div>
  );
}
