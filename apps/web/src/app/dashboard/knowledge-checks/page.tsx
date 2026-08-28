"use client";

import { useState, type FormEvent } from "react";
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
import { api } from "@/lib/api";
import { statusVariant } from "@/lib/status-variant";

function errorMessage(err: unknown, fallback: string) {
  const message =
    err && typeof err === "object" && "body" in err
      ? ((err as { body?: { message?: string } }).body?.message ?? null)
      : null;
  return typeof message === "string" ? message : fallback;
}

export default function KnowledgeChecksPage() {
  const checks = useSWR("knowledge-checks", () => api.listKnowledgeChecks());
  const teachingAssignments = useSWR("teaching-assignments", () => api.listTeachingAssignments());
  // Deliberately the unbounded, narrow picker — this is a "pick a
  // student" dropdown, not the paginated admin list view (Phase 8
  // performance-optimization slice).
  const students = useSWR("students-picker", () => api.listStudentsPicker());

  const [form, setForm] = useState({ teachingAssignmentId: "", title: "", durationMinutes: "" });

  const [activeCheckId, setActiveCheckId] = useState<string | null>(null);
  const activeCheck = useSWR(
    activeCheckId ? ["knowledge-check", activeCheckId] : null,
    () => api.getKnowledgeCheck(activeCheckId as string),
  );

  const [questionForm, setQuestionForm] = useState({
    sequence: "1",
    text: "",
    options: ["", "", "", ""],
    correctOptionIndex: "0",
  });
  const [attemptStudentId, setAttemptStudentId] = useState("");
  const [attemptAnswers, setAttemptAnswers] = useState<Record<string, string>>({});

  async function submit(action: () => Promise<unknown>, onSuccess: () => void) {
    try {
      await action();
      onSuccess();
      toast.success("Saved");
    } catch (err) {
      toast.error(errorMessage(err, "Failed — check that required fields are filled in"));
    }
  }

  const nonEmptyOptions = questionForm.options.map((o) => o.trim()).filter(Boolean);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Knowledge Checks</h1>
        <p className="text-muted-foreground text-sm">
          Short objective assessments. Add questions, publish when ready, then record student
          attempts — scored automatically.
        </p>
      </div>

      <EntityCard
        title="Knowledge checks"
        emptyLabel="No knowledge checks yet."
        items={checks.data}
        renderItem={(c: {
          id: string;
          title: string;
          status: string;
          teachingAssignment: { subject: { name: string }; section: { name: string } };
          questions: unknown[];
          attempts: unknown[];
        }) => (
          <button
            type="button"
            className="hover:text-primary flex flex-wrap items-center gap-2 text-left"
            onClick={() => setActiveCheckId(c.id)}
          >
            {c.title} — {c.teachingAssignment.subject.name} for {c.teachingAssignment.section.name}
            <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
            <span className="text-muted-foreground">
              ({c.questions.length} questions · {c.attempts.length} attempts)
            </span>
          </button>
        )}
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(
              () =>
                api.createKnowledgeCheck({
                  teachingAssignmentId: form.teachingAssignmentId,
                  title: form.title,
                  durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : undefined,
                }),
              () => {
                setForm({ teachingAssignmentId: "", title: "", durationMinutes: "" });
                checks.mutate();
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
            <Input required className="w-48" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Duration (min, optional)</Label>
            <Input
              type="number"
              className="w-24"
              value={form.durationMinutes}
              onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))}
            />
          </div>
          <Button type="submit" disabled={!form.teachingAssignmentId || !form.title}>
            Add
          </Button>
        </form>
      </EntityCard>

      {activeCheckId ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {activeCheck.data ? (
                <>
                  {activeCheck.data.title}
                  <Badge variant={statusVariant(activeCheck.data.status)}>{activeCheck.data.status}</Badge>
                </>
              ) : (
                "Loading…"
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeCheck.data ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : (
              <>
                {activeCheck.data.questions.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No questions yet.</p>
                ) : (
                  <ol className="list-decimal space-y-1 pl-5 text-sm">
                    {activeCheck.data.questions.map((q) => (
                      <li key={q.id}>
                        {q.text}{" "}
                        <span className="text-muted-foreground">
                          ({q.options.join(" / ")} — correct: {q.options[q.correctOptionIndex]})
                        </span>
                      </li>
                    ))}
                  </ol>
                )}

                {activeCheck.data.status === "DRAFT" ? (
                  <form
                    className="space-y-2"
                    onSubmit={(e: FormEvent) => {
                      e.preventDefault();
                      if (!activeCheckId) return;
                      submit(
                        () =>
                          api.addKnowledgeCheckQuestion(activeCheckId, {
                            sequence: Number(questionForm.sequence),
                            text: questionForm.text,
                            options: nonEmptyOptions,
                            correctOptionIndex: Number(questionForm.correctOptionIndex),
                          }),
                        () => {
                          setQuestionForm({ sequence: String(Number(questionForm.sequence) + 1), text: "", options: ["", "", "", ""], correctOptionIndex: "0" });
                          activeCheck.mutate();
                        },
                      );
                    }}
                  >
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="space-y-2">
                        <Label>Question</Label>
                        <Input
                          required
                          className="w-64"
                          value={questionForm.text}
                          onChange={(e) => setQuestionForm((f) => ({ ...f, text: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Sequence</Label>
                        <Input
                          type="number"
                          className="w-16"
                          value={questionForm.sequence}
                          onChange={(e) => setQuestionForm((f) => ({ ...f, sequence: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      {questionForm.options.map((opt, i) => (
                        <div key={i} className="space-y-2">
                          <Label>Option {i + 1}{i < 2 ? "" : " (optional)"}</Label>
                          <Input
                            className="w-32"
                            value={opt}
                            onChange={(e) =>
                              setQuestionForm((f) => ({
                                ...f,
                                options: f.options.map((o, j) => (j === i ? e.target.value : o)),
                              }))
                            }
                          />
                        </div>
                      ))}
                      <div className="space-y-2">
                        <Label>Correct option</Label>
                        <NativeSelect
                          className="w-40"
                          placeholder="Select correct option"
                          value={questionForm.correctOptionIndex}
                          onChange={(v) => setQuestionForm((f) => ({ ...f, correctOptionIndex: v }))}
                          options={nonEmptyOptions.map((o, i) => ({ value: String(i), label: o }))}
                        />
                      </div>
                      <Button type="submit" disabled={nonEmptyOptions.length < 2 || !questionForm.text}>
                        Add question
                      </Button>
                    </div>
                  </form>
                ) : null}

                <Separator />

                {activeCheck.data.status === "DRAFT" ? (
                  <Button
                    type="button"
                    disabled={activeCheck.data.questions.length === 0}
                    onClick={() => {
                      if (!activeCheckId) return;
                      submit(
                        () => api.publishKnowledgeCheck(activeCheckId),
                        () => activeCheck.mutate(),
                      );
                    }}
                  >
                    Publish
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Record an attempt</p>
                    {activeCheck.data.attempts.length > 0 ? (
                      <ul className="text-muted-foreground text-sm">
                        {activeCheck.data.attempts.map((a) => (
                          <li key={a.id}>
                            {a.student.firstName} {a.student.lastName} —{" "}
                            {a.score !== null ? `${a.score.toFixed(0)}%` : "In progress"}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="space-y-2">
                        <Label>Student</Label>
                        <NativeSelect
                          className="w-40"
                          placeholder="Select student"
                          value={attemptStudentId}
                          onChange={setAttemptStudentId}
                          options={(students.data ?? []).map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }))}
                        />
                      </div>
                    </div>
                    {activeCheck.data.questions.map((q) => (
                      <div key={q.id} className="space-y-2">
                        <Label className="text-xs">{q.text}</Label>
                        <NativeSelect
                          className="w-56"
                          placeholder="Select answer"
                          value={attemptAnswers[q.id] ?? ""}
                          onChange={(v) => setAttemptAnswers((a) => ({ ...a, [q.id]: v }))}
                          options={q.options.map((o, i) => ({ value: String(i), label: o }))}
                        />
                      </div>
                    ))}
                    <Button
                      type="button"
                      disabled={
                        !attemptStudentId ||
                        activeCheck.data.questions.some((q) => attemptAnswers[q.id] === undefined)
                      }
                      onClick={() => {
                        if (!activeCheckId || !activeCheck.data) return;
                        const answers = activeCheck.data.questions.map((q) => Number(attemptAnswers[q.id]));
                        submit(
                          () => api.attemptKnowledgeCheck(activeCheckId, { studentId: attemptStudentId, answers }),
                          () => {
                            setAttemptStudentId("");
                            setAttemptAnswers({});
                            activeCheck.mutate();
                          },
                        );
                      }}
                    >
                      Record attempt
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
