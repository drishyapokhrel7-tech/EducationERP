"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { EntityCard } from "@/components/dashboard/entity-card";
import { api } from "@/lib/api";
import type { SyllabusNode, SyllabusNodeLevel } from "@education-erp/api-client";

const LEVEL_OPTIONS: { value: SyllabusNodeLevel; label: string }[] = [
  { value: "UNIT", label: "Unit" },
  { value: "CHAPTER", label: "Chapter" },
  { value: "TOPIC", label: "Topic" },
  { value: "SUBTOPIC", label: "Subtopic" },
];
const REQUIRED_PARENT_LEVEL: Record<SyllabusNodeLevel, SyllabusNodeLevel | null> = {
  UNIT: null,
  CHAPTER: "UNIT",
  TOPIC: "CHAPTER",
  SUBTOPIC: "TOPIC",
};
const INDENT: Record<SyllabusNodeLevel, string> = {
  UNIT: "pl-0",
  CHAPTER: "pl-4",
  TOPIC: "pl-8",
  SUBTOPIC: "pl-12",
};

// Depth-first order, parents before children, using each node's own
// sequence among siblings — matches how the level-ordering rule
// guarantees a valid tree (no cycles, single root level).
function orderTree(nodes: SyllabusNode[]): SyllabusNode[] {
  const byParent = new Map<string | null, SyllabusNode[]>();
  for (const node of nodes) {
    const key = node.parentId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(node);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.sequence - b.sequence);

  const ordered: SyllabusNode[] = [];
  function visit(parentId: string | null) {
    for (const node of byParent.get(parentId) ?? []) {
      ordered.push(node);
      visit(node.id);
    }
  }
  visit(null);
  return ordered;
}

export default function SyllabusPage() {
  const syllabi = useSWR("syllabi", () => api.listSyllabi());
  const curricula = useSWR("curricula", () => api.listCurricula());
  const terms = useSWR("terms", () => api.listTerms());
  const teachingAssignments = useSWR("teaching-assignments", () => api.listTeachingAssignments());
  const lessonPlans = useSWR("lesson-plans", () => api.listLessonPlans());

  const curriculumSubjectOptions = (curricula.data ?? []).flatMap((c) =>
    c.subjects.map((cs) => ({ value: cs.id, label: `${c.name} · ${cs.subject.name}` })),
  );

  const [syllabusForm, setSyllabusForm] = useState({ curriculumSubjectId: "", termId: "", name: "" });
  const [activeSyllabusId, setActiveSyllabusId] = useState<string | null>(null);
  const activeSyllabus = useSWR(
    activeSyllabusId ? ["syllabus", activeSyllabusId] : null,
    () => api.getSyllabus(activeSyllabusId as string),
  );

  const [nodeForm, setNodeForm] = useState({
    level: "UNIT" as SyllabusNodeLevel,
    parentId: "",
    sequence: "1",
    name: "",
    description: "",
  });
  const [objectiveTarget, setObjectiveTarget] = useState<string | null>(null);
  const [objectiveForm, setObjectiveForm] = useState({ sequence: "1", description: "" });

  const [lessonPlanForm, setLessonPlanForm] = useState({
    teachingAssignmentId: "",
    syllabusNodeId: "",
    title: "",
    objectives: "",
  });

  function errorMessage(err: unknown, fallback: string) {
    const message =
      err && typeof err === "object" && "body" in err
        ? ((err as { body?: { message?: string } }).body?.message ?? null)
        : null;
    return typeof message === "string" ? message : fallback;
  }

  async function submit(action: () => Promise<unknown>, onSuccess: () => void) {
    try {
      await action();
      onSuccess();
      toast.success("Saved");
    } catch (err) {
      toast.error(errorMessage(err, "Failed — check that required fields are filled in"));
    }
  }

  const nodes = activeSyllabus.data ? orderTree(activeSyllabus.data.nodes) : [];
  const parentCandidates = (activeSyllabus.data?.nodes ?? []).filter(
    (n) => n.level === REQUIRED_PARENT_LEVEL[nodeForm.level],
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Syllabus</h1>
        <p className="text-muted-foreground text-sm">
          A syllabus belongs to one curriculum subject and term, and is organized as
          unit → chapter → topic → subtopic. Lesson plans attach a teaching assignment to a node.
        </p>
      </div>

      <EntityCard
        title="Syllabi"
        emptyLabel="No syllabi yet."
        items={syllabi.data}
        renderItem={(s: {
          id: string;
          name: string | null;
          curriculumSubject: { subject: { name: string }; curriculum: { name: string } };
          term: { name: string };
        }) => (
          <button
            type="button"
            className="hover:text-primary text-left"
            onClick={() => setActiveSyllabusId(s.id)}
          >
            {s.name || `${s.curriculumSubject.curriculum.name} · ${s.curriculumSubject.subject.name}`}{" "}
            <span className="text-muted-foreground">({s.term.name})</span>
          </button>
        )}
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(
              () =>
                api.createSyllabus({
                  curriculumSubjectId: syllabusForm.curriculumSubjectId,
                  termId: syllabusForm.termId,
                  name: syllabusForm.name || undefined,
                }),
              () => {
                setSyllabusForm({ curriculumSubjectId: "", termId: "", name: "" });
                syllabi.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Curriculum subject</Label>
            <NativeSelect
              className="w-64"
              placeholder="Select curriculum subject"
              value={syllabusForm.curriculumSubjectId}
              onChange={(v) => setSyllabusForm((f) => ({ ...f, curriculumSubjectId: v }))}
              options={curriculumSubjectOptions}
            />
          </div>
          <div className="space-y-2">
            <Label>Term</Label>
            <NativeSelect
              className="w-36"
              placeholder="Select term"
              value={syllabusForm.termId}
              onChange={(v) => setSyllabusForm((f) => ({ ...f, termId: v }))}
              options={(terms.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Name (optional)</Label>
            <Input
              className="w-40"
              value={syllabusForm.name}
              onChange={(e) => setSyllabusForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <Button type="submit" disabled={!syllabusForm.curriculumSubjectId || !syllabusForm.termId}>
            Add
          </Button>
        </form>
      </EntityCard>

      {activeSyllabusId ? (
        <Card>
          <CardHeader>
            <CardTitle>Syllabus structure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeSyllabus.data ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : nodes.length === 0 ? (
              <p className="text-muted-foreground text-sm">No units yet.</p>
            ) : (
              <ul className="divide-y">
                {nodes.map((node) => (
                  <li key={node.id} className={`py-2 text-sm ${INDENT[node.level]}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span>
                        <span className="text-muted-foreground">{node.level}</span> {node.name}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-7"
                        onClick={() => {
                          setObjectiveTarget(objectiveTarget === node.id ? null : node.id);
                          setObjectiveForm({ sequence: "1", description: "" });
                        }}
                      >
                        + Objective
                      </Button>
                    </div>
                    {node.learningObjectives.length > 0 ? (
                      <ul className="text-muted-foreground mt-1 list-disc pl-5 text-xs">
                        {node.learningObjectives
                          .slice()
                          .sort((a, b) => a.sequence - b.sequence)
                          .map((o) => (
                            <li key={o.id}>{o.description}</li>
                          ))}
                      </ul>
                    ) : null}
                    {objectiveTarget === node.id ? (
                      <div className="bg-muted/50 mt-2 flex flex-wrap items-end gap-2 rounded-lg p-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Description</Label>
                          <Input
                            className="w-56"
                            value={objectiveForm.description}
                            onChange={(e) =>
                              setObjectiveForm((f) => ({ ...f, description: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Sequence</Label>
                          <Input
                            className="w-16"
                            type="number"
                            value={objectiveForm.sequence}
                            onChange={(e) => setObjectiveForm((f) => ({ ...f, sequence: e.target.value }))}
                          />
                        </div>
                        <Button
                          type="button"
                          className="h-8"
                          disabled={!objectiveForm.description}
                          onClick={() => {
                            submit(
                              () =>
                                api.createLearningObjective(node.id, {
                                  sequence: Number(objectiveForm.sequence),
                                  description: objectiveForm.description,
                                }),
                              () => {
                                setObjectiveTarget(null);
                                activeSyllabus.mutate();
                              },
                            );
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (!activeSyllabusId) return;
                submit(
                  () =>
                    api.createSyllabusNode(activeSyllabusId, {
                      parentId: nodeForm.parentId || undefined,
                      level: nodeForm.level,
                      sequence: Number(nodeForm.sequence),
                      name: nodeForm.name,
                      description: nodeForm.description || undefined,
                    }),
                  () => {
                    setNodeForm({ level: "UNIT", parentId: "", sequence: "1", name: "", description: "" });
                    activeSyllabus.mutate();
                  },
                );
              }}
            >
              <div className="space-y-2">
                <Label>Level</Label>
                <NativeSelect
                  className="w-28"
                  value={nodeForm.level}
                  onChange={(v) =>
                    setNodeForm((f) => ({ ...f, level: v as SyllabusNodeLevel, parentId: "" }))
                  }
                  placeholder="Level"
                  options={LEVEL_OPTIONS}
                />
              </div>
              {REQUIRED_PARENT_LEVEL[nodeForm.level] ? (
                <div className="space-y-2">
                  <Label>Parent {REQUIRED_PARENT_LEVEL[nodeForm.level]}</Label>
                  <NativeSelect
                    className="w-48"
                    placeholder="Select parent"
                    value={nodeForm.parentId}
                    onChange={(v) => setNodeForm((f) => ({ ...f, parentId: v }))}
                    options={parentCandidates.map((n) => ({ value: n.id, label: n.name }))}
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  required
                  className="w-40"
                  value={nodeForm.name}
                  onChange={(e) => setNodeForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Sequence</Label>
                <Input
                  required
                  type="number"
                  className="w-16"
                  value={nodeForm.sequence}
                  onChange={(e) => setNodeForm((f) => ({ ...f, sequence: e.target.value }))}
                />
              </div>
              <Button
                type="submit"
                disabled={!nodeForm.name || (!!REQUIRED_PARENT_LEVEL[nodeForm.level] && !nodeForm.parentId)}
              >
                Add node
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <EntityCard
        title="Lesson plans"
        emptyLabel="No lesson plans yet."
        items={lessonPlans.data}
        renderItem={(p: {
          title: string;
          teachingAssignment: { subject: { name: string }; section: { name: string }; employee: { firstName: string; lastName: string } };
          syllabusNode: { name: string };
        }) => (
          <span>
            {p.title} — {p.teachingAssignment.subject.name} for {p.teachingAssignment.section.name}{" "}
            <span className="text-muted-foreground">
              ({p.teachingAssignment.employee.firstName} {p.teachingAssignment.employee.lastName} ·{" "}
              {p.syllabusNode.name})
            </span>
          </span>
        )}
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(
              () => api.createLessonPlan(lessonPlanForm),
              () => {
                setLessonPlanForm({ teachingAssignmentId: "", syllabusNodeId: "", title: "", objectives: "" });
                lessonPlans.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Teaching assignment</Label>
            <NativeSelect
              className="w-56"
              placeholder="Select assignment"
              value={lessonPlanForm.teachingAssignmentId}
              onChange={(v) => setLessonPlanForm((f) => ({ ...f, teachingAssignmentId: v }))}
              options={(teachingAssignments.data ?? []).map((a) => ({
                value: a.id,
                label: `${a.subject.name} · ${a.section.name} · ${a.employee.firstName} ${a.employee.lastName}`,
              }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Syllabus node</Label>
            <NativeSelect
              className="w-48"
              placeholder={activeSyllabusId ? "Select node" : "Open a syllabus above first"}
              value={lessonPlanForm.syllabusNodeId}
              onChange={(v) => setLessonPlanForm((f) => ({ ...f, syllabusNodeId: v }))}
              options={nodes.map((n) => ({ value: n.id, label: `${n.level}: ${n.name}` }))}
              disabled={!activeSyllabusId}
            />
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              required
              className="w-40"
              value={lessonPlanForm.title}
              onChange={(e) => setLessonPlanForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Objectives</Label>
            <Input
              required
              className="w-56"
              value={lessonPlanForm.objectives}
              onChange={(e) => setLessonPlanForm((f) => ({ ...f, objectives: e.target.value }))}
            />
          </div>
          <Button
            type="submit"
            disabled={
              !lessonPlanForm.teachingAssignmentId ||
              !lessonPlanForm.syllabusNodeId ||
              !lessonPlanForm.title ||
              !lessonPlanForm.objectives
            }
          >
            Add
          </Button>
        </form>
      </EntityCard>
    </div>
  );
}
