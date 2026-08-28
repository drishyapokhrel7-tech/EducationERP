"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { EntityCard } from "@/components/dashboard/entity-card";
import { api } from "@/lib/api";
import { submitAction, submitDelete } from "@/lib/submit-action";

export default function AcademicsPage() {
  const subjects = useSWR("subjects", () => api.listSubjects());
  const curricula = useSWR("curricula", () => api.listCurricula());
  const programs = useSWR("programs", () => api.listPrograms());

  const [subjectForm, setSubjectForm] = useState({ name: "", code: "" });
  const [curriculumForm, setCurriculumForm] = useState({ programId: "", name: "", code: "" });
  const [attachForm, setAttachForm] = useState({
    curriculumId: "",
    subjectId: "",
    isCompulsory: true,
  });

  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editSubjectForm, setEditSubjectForm] = useState({ name: "", code: "" });
  const [editingCurriculumId, setEditingCurriculumId] = useState<string | null>(null);
  const [editCurriculumForm, setEditCurriculumForm] = useState({ programId: "", name: "", code: "" });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Academics</h1>
        <p className="text-muted-foreground text-sm">
          Subjects are an organization-wide catalog. A curriculum names one subject combination
          for a program — a program can have more than one (e.g. multiple +2 streams).
        </p>
      </div>

      <EntityCard
        title="Subjects"
        emptyLabel="No subjects yet."
        items={subjects.data}
        renderItem={(s: { id: string; name: string; code: string }) => (
          <div className="flex items-center justify-between gap-2">
            <span>
              {s.name} <span className="text-muted-foreground">{s.code}</span>
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingSubjectId(s.id);
                  setEditSubjectForm({ name: s.name, code: s.code });
                }}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => submitDelete(() => api.deleteSubject(s.id), () => subjects.mutate())}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
        footer={
          editingSubjectId ? (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                submitAction(
                  () => api.updateSubject(editingSubjectId, editSubjectForm),
                  () => {
                    setEditingSubjectId(null);
                    subjects.mutate();
                  },
                );
              }}
            >
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  required
                  value={editSubjectForm.name}
                  onChange={(e) => setEditSubjectForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  required
                  className="w-24"
                  value={editSubjectForm.code}
                  onChange={(e) => setEditSubjectForm((f) => ({ ...f, code: e.target.value }))}
                />
              </div>
              <Button type="submit" size="sm">
                Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingSubjectId(null)}>
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
              () => api.createSubject(subjectForm),
              () => {
                setSubjectForm({ name: "", code: "" });
                subjects.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              required
              value={subjectForm.name}
              onChange={(e) => setSubjectForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Code</Label>
            <Input
              required
              className="w-24"
              value={subjectForm.code}
              onChange={(e) => setSubjectForm((f) => ({ ...f, code: e.target.value }))}
            />
          </div>
          <Button type="submit">Add</Button>
        </form>
      </EntityCard>

      <EntityCard
        title="Curricula"
        emptyLabel="No curricula yet."
        items={curricula.data}
        renderItem={(c: {
          id: string;
          programId: string;
          name: string;
          code: string;
          subjects: { subject: { name: string }; isCompulsory: boolean }[];
        }) => (
          <div className="flex items-center justify-between gap-2">
            <div>
              <span>
                {c.name} <span className="text-muted-foreground">{c.code}</span>
              </span>
              {c.subjects.length > 0 ? (
                <p className="text-muted-foreground mt-1 text-xs">
                  {c.subjects
                    .map((cs) => cs.subject.name + (cs.isCompulsory ? "" : " (elective)"))
                    .join(", ")}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingCurriculumId(c.id);
                  setEditCurriculumForm({ programId: c.programId, name: c.name, code: c.code });
                }}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => submitDelete(() => api.deleteCurriculum(c.id), () => curricula.mutate())}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
        footer={
          editingCurriculumId ? (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                submitAction(
                  () => api.updateCurriculum(editingCurriculumId, editCurriculumForm),
                  () => {
                    setEditingCurriculumId(null);
                    curricula.mutate();
                  },
                );
              }}
            >
              <div className="space-y-2">
                <Label>Program</Label>
                <NativeSelect
                  className="w-40"
                  placeholder="Select program"
                  value={editCurriculumForm.programId}
                  onChange={(v) => setEditCurriculumForm((f) => ({ ...f, programId: v }))}
                  options={(programs.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  required
                  value={editCurriculumForm.name}
                  onChange={(e) => setEditCurriculumForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  required
                  className="w-24"
                  value={editCurriculumForm.code}
                  onChange={(e) => setEditCurriculumForm((f) => ({ ...f, code: e.target.value }))}
                />
              </div>
              <Button type="submit" size="sm">
                Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingCurriculumId(null)}>
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
              () => api.createCurriculum(curriculumForm),
              () => {
                setCurriculumForm({ programId: "", name: "", code: "" });
                curricula.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Program</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select program"
              value={curriculumForm.programId}
              onChange={(v) => setCurriculumForm((f) => ({ ...f, programId: v }))}
              options={(programs.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              required
              placeholder="Option 1"
              value={curriculumForm.name}
              onChange={(e) => setCurriculumForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Code</Label>
            <Input
              required
              className="w-24"
              value={curriculumForm.code}
              onChange={(e) => setCurriculumForm((f) => ({ ...f, code: e.target.value }))}
            />
          </div>
          <Button type="submit" disabled={!curriculumForm.programId}>
            Add
          </Button>
        </form>

        <Separator />

        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submitAction(
              () =>
                api.attachCurriculumSubject(attachForm.curriculumId, {
                  subjectId: attachForm.subjectId,
                  isCompulsory: attachForm.isCompulsory,
                }),
              () => {
                setAttachForm((f) => ({ ...f, subjectId: "" }));
                curricula.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Attach subject to curriculum</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select curriculum"
              value={attachForm.curriculumId}
              onChange={(v) => setAttachForm((f) => ({ ...f, curriculumId: v }))}
              options={(curricula.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select subject"
              value={attachForm.subjectId}
              onChange={(v) => setAttachForm((f) => ({ ...f, subjectId: v }))}
              options={(subjects.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>
          <div className="flex items-center gap-2 pb-2">
            <input
              type="checkbox"
              id="isCompulsory"
              checked={attachForm.isCompulsory}
              onChange={(e) => setAttachForm((f) => ({ ...f, isCompulsory: e.target.checked }))}
            />
            <Label htmlFor="isCompulsory">Compulsory</Label>
          </div>
          <Button type="submit" disabled={!attachForm.curriculumId || !attachForm.subjectId}>
            Attach
          </Button>
        </form>
      </EntityCard>
    </div>
  );
}
