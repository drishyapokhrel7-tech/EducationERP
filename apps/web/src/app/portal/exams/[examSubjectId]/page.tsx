"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { ExamTakingQuestion } from "@education-erp/api-client";

function formatCountdown(msRemaining: number): string {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

export default function TakeExamPage() {
  const params = useParams<{ examSubjectId: string }>();
  const examSubjectId = params.examSubjectId;
  const router = useRouter();

  const exam = useSWR(["start-exam", examSubjectId], () => api.startMyExam(examSubjectId), {
    revalidateOnFocus: false,
  });

  // Local edit state, seeded from the server's current saved answers —
  // avoids re-seeding on every SWR revalidation (which would clobber an
  // in-flight edit the student hasn't finished typing yet).
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !exam.data) return;
    seeded.current = true;
    const nextSelections: Record<string, number> = {};
    const nextTexts: Record<string, string> = {};
    for (const q of exam.data.questions) {
      if (q.selectedOptionIndex !== undefined) nextSelections[q.id] = q.selectedOptionIndex;
      if (q.textAnswer !== undefined) nextTexts[q.id] = q.textAnswer;
    }
    setSelections(nextSelections);
    setTexts(nextTexts);
  }, [exam.data]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const deadline = exam.data ? new Date(exam.data.deadline).getTime() : null;
  const msRemaining = deadline !== null ? deadline - now : null;

  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  async function submit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      await api.submitMyExam(examSubjectId);
      toast.success("Exam submitted");
      router.push("/portal/exams");
    } catch {
      toast.error("Failed to submit — please try again");
      submittedRef.current = false;
    } finally {
      setSubmitting(false);
    }
  }

  // Auto-submit once the deadline passes — the one server-enforced
  // backstop is that saves are rejected past the deadline too; this is
  // the client doing its part to close the loop automatically.
  useEffect(() => {
    if (msRemaining !== null && msRemaining <= 0 && exam.data) {
      submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msRemaining !== null && msRemaining <= 0]);

  async function saveAnswer(question: ExamTakingQuestion, input: { selectedOptionIndex?: number; textAnswer?: string }) {
    try {
      await api.saveMyAnswer(examSubjectId, question.id, input);
    } catch {
      toast.error("Failed to save your answer — check your connection");
    }
  }

  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  function saveTextDebounced(question: ExamTakingQuestion, value: string) {
    setTexts((t) => ({ ...t, [question.id]: value }));
    clearTimeout(debounceRef.current[question.id]);
    debounceRef.current[question.id] = setTimeout(() => saveAnswer(question, { textAnswer: value }), 800);
  }

  const answeredCount = useMemo(() => {
    if (!exam.data) return 0;
    return exam.data.questions.filter(
      (q) => selections[q.id] !== undefined || (texts[q.id] ?? "").trim().length > 0,
    ).length;
  }, [exam.data, selections, texts]);

  if (exam.error) {
    return (
      <div className="max-w-2xl">
        <p className="text-destructive text-sm">
          This exam isn&apos;t available right now — check with your teacher if you think this is wrong.
        </p>
      </div>
    );
  }

  if (!exam.data) {
    return (
      <div className="max-w-2xl">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Exam in progress</h1>
          <p className="text-muted-foreground text-sm">
            {answeredCount} of {exam.data.questions.length} answered
          </p>
        </div>
        {msRemaining !== null ? (
          <div className="text-right">
            <p className="text-muted-foreground text-xs">Time remaining</p>
            <p className="font-mono text-lg font-semibold">{formatCountdown(msRemaining)}</p>
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        {exam.data.questions.map((q, i) => (
          <Card key={q.id}>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                {i + 1}. {q.text}{" "}
                <span className="text-muted-foreground text-xs font-normal">({q.marks} marks)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {q.questionType === "OBJECTIVE" ? (
                <div className="space-y-2">
                  {(q.options ?? []).map((option, optionIndex) => (
                    <label key={optionIndex} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={q.id}
                        checked={selections[q.id] === optionIndex}
                        onChange={() => {
                          setSelections((s) => ({ ...s, [q.id]: optionIndex }));
                          saveAnswer(q, { selectedOptionIndex: optionIndex });
                        }}
                      />
                      {option}
                    </label>
                  ))}
                </div>
              ) : (
                <textarea
                  className="border-input bg-transparent min-h-24 w-full rounded-lg border p-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={texts[q.id] ?? ""}
                  onChange={(e) => saveTextDebounced(q, e.target.value)}
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        type="button"
        disabled={submitting}
        onClick={() => {
          if (window.confirm("Submit this exam? You won't be able to change your answers after.")) {
            submit();
          }
        }}
      >
        {submitting ? "Submitting…" : "Submit exam"}
      </Button>
    </div>
  );
}
