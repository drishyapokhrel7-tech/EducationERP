"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { EntityCard } from "@/components/dashboard/entity-card";
import { api } from "@/lib/api";
import type { GradeBand, QuestionType } from "@education-erp/api-client";

function errorMessage(err: unknown, fallback: string) {
  const message =
    err && typeof err === "object" && "body" in err
      ? ((err as { body?: { message?: string } }).body?.message ?? null)
      : null;
  return typeof message === "string" ? message : fallback;
}

const emptyBand: GradeBand = { minPercentage: 0, maxPercentage: 0, grade: "" };

export default function ExamSetupPage() {
  const examTypes = useSWR("exam-types", () => api.listExamTypes());
  const gradingSchemes = useSWR("grading-schemes", () => api.listGradingSchemes());
  const questionBanks = useSWR("question-banks", () => api.listQuestionBanks());
  const curricula = useSWR("curricula", () => api.listCurricula());

  async function submit(action: () => Promise<unknown>, onSuccess: () => void) {
    try {
      await action();
      onSuccess();
      toast.success("Saved");
    } catch (err) {
      toast.error(errorMessage(err, "Failed — check that required fields are filled in"));
    }
  }

  // --- Exam types ---------------------------------------------------------
  const [examTypeForm, setExamTypeForm] = useState({ name: "", code: "" });

  // --- Grading schemes -----------------------------------------------------
  const [schemeForm, setSchemeForm] = useState({ name: "", code: "", description: "" });
  const [bands, setBands] = useState<GradeBand[]>([{ ...emptyBand }]);

  // --- Question banks --------------------------------------------------------
  const curriculumSubjectOptions = (curricula.data ?? []).flatMap((c) =>
    c.subjects.map((cs) => ({ value: cs.id, label: `${c.name} · ${cs.subject.name}` })),
  );
  const [bankForm, setBankForm] = useState({ curriculumSubjectId: "", name: "", description: "" });

  const [activeBankId, setActiveBankId] = useState<string | null>(null);
  const activeBank = useSWR(activeBankId ? ["question-bank", activeBankId] : null, () =>
    api.getQuestionBank(activeBankId as string),
  );
  const [questionForm, setQuestionForm] = useState({
    sequence: "1",
    text: "",
    questionType: "OBJECTIVE" as QuestionType,
    marks: "1",
    options: ["", "", "", ""],
    correctOptionIndex: "0",
    modelAnswer: "",
  });
  const nonEmptyOptions = questionForm.options.map((o) => o.trim()).filter(Boolean);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Exam Setup</h1>
        <p className="text-muted-foreground text-sm">
          Phase 4 foundation — exam types, grading schemes and question banks that exams (a later
          slice) will draw on.
        </p>
      </div>

      <EntityCard
        title="Exam types"
        emptyLabel="No exam types yet."
        items={examTypes.data}
        renderItem={(t: { id: string; name: string; code: string }) => (
          <span>
            {t.name} <span className="text-muted-foreground">({t.code})</span>
          </span>
        )}
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(
              () => api.createExamType({ name: examTypeForm.name, code: examTypeForm.code }),
              () => {
                setExamTypeForm({ name: "", code: "" });
                examTypes.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              required
              className="w-48"
              value={examTypeForm.name}
              onChange={(e) => setExamTypeForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Code</Label>
            <Input
              required
              className="w-32"
              value={examTypeForm.code}
              onChange={(e) => setExamTypeForm((f) => ({ ...f, code: e.target.value }))}
            />
          </div>
          <Button type="submit" disabled={!examTypeForm.name || !examTypeForm.code}>
            Add
          </Button>
        </form>
      </EntityCard>

      <EntityCard
        title="Grading schemes"
        emptyLabel="No grading schemes yet."
        items={gradingSchemes.data}
        renderItem={(s: { id: string; name: string; code: string; bands: GradeBand[] }) => (
          <div>
            <p>
              {s.name} <span className="text-muted-foreground">({s.code})</span>
            </p>
            <p className="text-muted-foreground text-xs">
              {s.bands.map((b) => `${b.grade} (${b.minPercentage}-${b.maxPercentage}%)`).join(", ")}
            </p>
          </div>
        )}
      >
        <form
          className="space-y-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(
              () =>
                api.createGradingScheme({
                  name: schemeForm.name,
                  code: schemeForm.code,
                  description: schemeForm.description || undefined,
                  bands,
                }),
              () => {
                setSchemeForm({ name: "", code: "", description: "" });
                setBands([{ ...emptyBand }]);
                gradingSchemes.mutate();
              },
            );
          }}
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                required
                className="w-48"
                value={schemeForm.name}
                onChange={(e) => setSchemeForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Code</Label>
              <Input
                required
                className="w-32"
                value={schemeForm.code}
                onChange={(e) => setSchemeForm((f) => ({ ...f, code: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                className="w-56"
                value={schemeForm.description}
                onChange={(e) => setSchemeForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Grade bands</Label>
            {bands.map((band, i) => (
              <div key={i} className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Min %</Label>
                  <Input
                    type="number"
                    className="w-20"
                    value={band.minPercentage}
                    onChange={(e) =>
                      setBands((bs) =>
                        bs.map((b, j) => (j === i ? { ...b, minPercentage: Number(e.target.value) } : b)),
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max %</Label>
                  <Input
                    type="number"
                    className="w-20"
                    value={band.maxPercentage}
                    onChange={(e) =>
                      setBands((bs) =>
                        bs.map((b, j) => (j === i ? { ...b, maxPercentage: Number(e.target.value) } : b)),
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Grade</Label>
                  <Input
                    className="w-20"
                    value={band.grade}
                    onChange={(e) =>
                      setBands((bs) => bs.map((b, j) => (j === i ? { ...b, grade: e.target.value } : b)))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">GPA (optional)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    className="w-20"
                    value={band.gpa ?? ""}
                    onChange={(e) =>
                      setBands((bs) =>
                        bs.map((b, j) =>
                          j === i ? { ...b, gpa: e.target.value ? Number(e.target.value) : undefined } : b,
                        ),
                      )
                    }
                  />
                </div>
                {bands.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setBands((bs) => bs.filter((_, j) => j !== i))}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => setBands((bs) => [...bs, { ...emptyBand }])}>
              + Add band
            </Button>
          </div>

          <Button
            type="submit"
            disabled={!schemeForm.name || !schemeForm.code || bands.some((b) => !b.grade)}
          >
            Save grading scheme
          </Button>
        </form>
      </EntityCard>

      <EntityCard
        title="Question banks"
        emptyLabel="No question banks yet."
        items={questionBanks.data}
        renderItem={(b: {
          id: string;
          name: string;
          curriculumSubject: { subject: { name: string }; curriculum: { name: string } };
        }) => (
          <button type="button" className="hover:text-primary text-left" onClick={() => setActiveBankId(b.id)}>
            {b.name}{" "}
            <span className="text-muted-foreground">
              ({b.curriculumSubject.curriculum.name} · {b.curriculumSubject.subject.name})
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
                api.createQuestionBank({
                  curriculumSubjectId: bankForm.curriculumSubjectId,
                  name: bankForm.name,
                  description: bankForm.description || undefined,
                }),
              () => {
                setBankForm({ curriculumSubjectId: "", name: "", description: "" });
                questionBanks.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Curriculum subject</Label>
            <NativeSelect
              className="w-56"
              placeholder="Select subject"
              value={bankForm.curriculumSubjectId}
              onChange={(v) => setBankForm((f) => ({ ...f, curriculumSubjectId: v }))}
              options={curriculumSubjectOptions}
            />
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              required
              className="w-48"
              value={bankForm.name}
              onChange={(e) => setBankForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <Button type="submit" disabled={!bankForm.curriculumSubjectId || !bankForm.name}>
            Add
          </Button>
        </form>
      </EntityCard>

      {activeBankId ? (
        <Card>
          <CardHeader>
            <CardTitle>{activeBank.data ? activeBank.data.name : "Loading…"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeBank.data ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : (
              <>
                {activeBank.data.questions.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No questions yet.</p>
                ) : (
                  <ol className="list-decimal space-y-1 pl-5 text-sm">
                    {activeBank.data.questions.map((q) => (
                      <li key={q.id}>
                        {q.text} <span className="text-muted-foreground">({q.marks} marks)</span>
                        {q.questionType === "OBJECTIVE" && q.options && q.correctOptionIndex !== null ? (
                          <span className="text-muted-foreground">
                            {" "}
                            — {q.options.join(" / ")} — correct: {q.options[q.correctOptionIndex]}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}

                <Separator />

                <form
                  className="space-y-3"
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    if (!activeBankId) return;
                    submit(
                      () =>
                        api.addExamQuestion(activeBankId, {
                          sequence: Number(questionForm.sequence),
                          text: questionForm.text,
                          questionType: questionForm.questionType,
                          marks: Number(questionForm.marks),
                          options: questionForm.questionType === "OBJECTIVE" ? nonEmptyOptions : undefined,
                          correctOptionIndex:
                            questionForm.questionType === "OBJECTIVE"
                              ? Number(questionForm.correctOptionIndex)
                              : undefined,
                          modelAnswer: questionForm.modelAnswer || undefined,
                        }),
                      () => {
                        setQuestionForm({
                          sequence: String(Number(questionForm.sequence) + 1),
                          text: "",
                          questionType: "OBJECTIVE",
                          marks: "1",
                          options: ["", "", "", ""],
                          correctOptionIndex: "0",
                          modelAnswer: "",
                        });
                        activeBank.mutate();
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
                    <div className="space-y-2">
                      <Label>Marks</Label>
                      <Input
                        type="number"
                        className="w-16"
                        value={questionForm.marks}
                        onChange={(e) => setQuestionForm((f) => ({ ...f, marks: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <NativeSelect
                        className="w-40"
                        placeholder="Select type"
                        value={questionForm.questionType}
                        onChange={(v) => setQuestionForm((f) => ({ ...f, questionType: v as QuestionType }))}
                        options={[
                          { value: "OBJECTIVE", label: "Objective" },
                          { value: "SUBJECTIVE", label: "Subjective" },
                        ]}
                      />
                    </div>
                  </div>

                  {questionForm.questionType === "OBJECTIVE" ? (
                    <div className="flex flex-wrap items-end gap-3">
                      {questionForm.options.map((opt, i) => (
                        <div key={i} className="space-y-2">
                          <Label>
                            Option {i + 1}
                            {i < 2 ? "" : " (optional)"}
                          </Label>
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
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Model answer (optional, for the grader — not auto-scored)</Label>
                      <Input
                        className="w-full"
                        value={questionForm.modelAnswer}
                        onChange={(e) => setQuestionForm((f) => ({ ...f, modelAnswer: e.target.value }))}
                      />
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={
                      !questionForm.text ||
                      !questionForm.marks ||
                      (questionForm.questionType === "OBJECTIVE" && nonEmptyOptions.length < 2)
                    }
                  >
                    Add question
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
