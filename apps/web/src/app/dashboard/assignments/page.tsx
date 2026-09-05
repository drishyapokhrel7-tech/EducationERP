"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { EntityCard } from "@/components/dashboard/entity-card";
import { api } from "@/lib/api";
import { statusVariant } from "@/lib/status-variant";
import { submitAction } from "@/lib/submit-action";
import type { SubmissionType } from "@education-erp/api-client";

const SUBMISSION_TYPE_OPTIONS: { value: SubmissionType; label: string }[] = [
  { value: "WRITTEN", label: "Written" },
  { value: "OBJECTIVE", label: "Objective" },
  { value: "PROJECT", label: "Project" },
  { value: "PRACTICAL", label: "Practical" },
  { value: "FILE", label: "File" },
  { value: "IMAGE", label: "Image" },
  { value: "PDF", label: "PDF" },
  { value: "LINK", label: "Link" },
  { value: "TEXT", label: "Text" },
];

export default function AssignmentsPage() {
  const assignments = useSWR("assignments", () => api.listAssignments());
  const teachingAssignments = useSWR("teaching-assignments", () => api.listTeachingAssignments());
  // Deliberately the unbounded, narrow picker — this is a "pick a
  // student" dropdown, not the paginated admin list view (Phase 8
  // performance-optimization slice).
  const students = useSWR("students-picker", () => api.listStudentsPicker());

  const [form, setForm] = useState({
    teachingAssignmentId: "",
    title: "",
    description: "",
    submissionType: "WRITTEN" as SubmissionType,
    dueDate: "",
    allowResubmission: false,
    maxScore: "",
  });

  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const activeAssignment = useSWR(
    activeAssignmentId ? ["assignment", activeAssignmentId] : null,
    () => api.getAssignment(activeAssignmentId as string),
  );
  const [submissionForm, setSubmissionForm] = useState({ studentId: "", content: "" });
  const [gradeTarget, setGradeTarget] = useState<string | null>(null);
  const [gradeForm, setGradeForm] = useState({ score: "", feedback: "" });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Assignments</h1>
        <p className="text-muted-foreground text-sm">
          Create an assignment for a teaching assignment, then record and grade student
          submissions.
        </p>
      </div>

      <EntityCard
        title="Assignments"
        emptyLabel="No assignments yet."
        items={assignments.data}
        renderItem={(a: {
          id: string;
          title: string;
          submissionType: string;
          dueDate: string | null;
          teachingAssignment: { subject: { name: string }; section: { name: string } };
          submissions: unknown[];
        }) => (
          <button type="button" className="hover:text-primary text-left" onClick={() => setActiveAssignmentId(a.id)}>
            {a.title} — {a.teachingAssignment.subject.name} for {a.teachingAssignment.section.name}{" "}
            <span className="text-muted-foreground">
              ({a.submissionType}
              {a.dueDate ? ` · due ${new Date(a.dueDate).toLocaleDateString()}` : ""} · {a.submissions.length} submitted)
            </span>
          </button>
        )}
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submitAction(
              () =>
                api.createAssignment({
                  teachingAssignmentId: form.teachingAssignmentId,
                  title: form.title,
                  description: form.description || undefined,
                  submissionType: form.submissionType,
                  dueDate: form.dueDate || undefined,
                  allowResubmission: form.allowResubmission,
                  maxScore: form.maxScore ? Number(form.maxScore) : undefined,
                }),
              () => {
                setForm({
                  teachingAssignmentId: "",
                  title: "",
                  description: "",
                  submissionType: "WRITTEN",
                  dueDate: "",
                  allowResubmission: false,
                  maxScore: "",
                });
                assignments.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Teaching assignment</Label>
            <NativeSelect
              className="w-56"
              placeholder="Select assignment"
              value={form.teachingAssignmentId}
              onChange={(v) => setForm((f) => ({ ...f, teachingAssignmentId: v }))}
              options={(teachingAssignments.data ?? []).map((a) => ({
                value: a.id,
                label: `${a.subject.name} · ${a.section.name} · ${a.employee.firstName} ${a.employee.lastName}`,
              }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input required className="w-40" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Submission type</Label>
            <NativeSelect
              className="w-32"
              value={form.submissionType}
              onChange={(v) => setForm((f) => ({ ...f, submissionType: v as SubmissionType }))}
              placeholder="Type"
              options={SUBMISSION_TYPE_OPTIONS}
            />
          </div>
          <div className="space-y-2">
            <Label>Due date (optional)</Label>
            <Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Max score (optional)</Label>
            <Input
              type="number"
              className="w-24"
              value={form.maxScore}
              onChange={(e) => setForm((f) => ({ ...f, maxScore: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.allowResubmission}
              onChange={(e) => setForm((f) => ({ ...f, allowResubmission: e.target.checked }))}
            />
            Allow resubmission
          </label>
          <Button type="submit" disabled={!form.teachingAssignmentId || !form.title}>
            Add
          </Button>
        </form>
      </EntityCard>

      {activeAssignmentId ? (
        <Card>
          <CardHeader>
            <CardTitle>Submissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeAssignment.data ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : activeAssignment.data.submissions.length === 0 ? (
              <p className="text-muted-foreground text-sm">No submissions yet.</p>
            ) : (
              <ul className="divide-y">
                {activeAssignment.data.submissions.map((s) => (
                  <li key={s.id} className="py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        {s.student.firstName} {s.student.lastName}
                        <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                        {s.score !== null ? (
                          <span className="text-muted-foreground">{s.score}</span>
                        ) : null}
                      </span>
                      <Button type="button" variant="outline" className="h-7" onClick={() => {
                        setGradeTarget(gradeTarget === s.studentId ? null : s.studentId);
                        setGradeForm({ score: s.score?.toString() ?? "", feedback: s.feedback ?? "" });
                      }}>
                        Grade
                      </Button>
                    </div>
                    {gradeTarget === s.studentId ? (
                      <div className="bg-muted/50 mt-2 flex flex-wrap items-end gap-2 rounded-lg p-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Score</Label>
                          <Input
                            type="number"
                            className="w-20"
                            value={gradeForm.score}
                            onChange={(e) => setGradeForm((f) => ({ ...f, score: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Feedback</Label>
                          <Input
                            className="w-48"
                            value={gradeForm.feedback}
                            onChange={(e) => setGradeForm((f) => ({ ...f, feedback: e.target.value }))}
                          />
                        </div>
                        <Button
                          type="button"
                          className="h-8"
                          disabled={!gradeForm.score}
                          onClick={() => {
                            if (!activeAssignmentId) return;
                            submitAction(
                              () =>
                                api.gradeSubmission(activeAssignmentId, s.studentId, {
                                  score: Number(gradeForm.score),
                                  feedback: gradeForm.feedback || undefined,
                                }),
                              () => {
                                setGradeTarget(null);
                                activeAssignment.mutate();
                              },
                            );
                          }}
                        >
                          Save grade
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            <Separator />

            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (!activeAssignmentId) return;
                submitAction(
                  () => api.submitAssignment(activeAssignmentId, submissionForm),
                  () => {
                    setSubmissionForm({ studentId: "", content: "" });
                    activeAssignment.mutate();
                  },
                );
              }}
            >
              <div className="space-y-2">
                <Label>Student</Label>
                <NativeSelect
                  className="w-40"
                  placeholder="Select student"
                  value={submissionForm.studentId}
                  onChange={(v) => setSubmissionForm((f) => ({ ...f, studentId: v }))}
                  options={(students.data ?? []).map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Content (optional)</Label>
                <Input
                  className="w-56"
                  value={submissionForm.content}
                  onChange={(e) => setSubmissionForm((f) => ({ ...f, content: e.target.value }))}
                />
              </div>
              <Button type="submit" disabled={!submissionForm.studentId}>
                Record submission
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
