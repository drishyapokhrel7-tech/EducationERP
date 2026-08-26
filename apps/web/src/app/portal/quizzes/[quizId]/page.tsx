"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { QuizTakingQuestion } from "@education-erp/api-client";

function formatCountdown(msRemaining: number): string {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

export default function TakeQuizPage() {
  const params = useParams<{ quizId: string }>();
  const quizId = params.quizId;
  const router = useRouter();

  // Idempotent — resumes the same in-progress attempt on a page
  // refresh, same convention as exam-taking's startExam.
  const quiz = useSWR(["start-quiz", quizId], () => api.startStudentQuiz(quizId), { revalidateOnFocus: false });

  // Local edit state, seeded from the server's currently-saved answers —
  // avoids re-seeding on every SWR revalidation, same as exam-taking.
  const [selections, setSelections] = useState<Record<string, number>>({});
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !quiz.data) return;
    seeded.current = true;
    const next: Record<string, number> = {};
    for (const q of quiz.data.questions) {
      if (q.selectedOptionIndex !== undefined) next[q.id] = q.selectedOptionIndex;
    }
    setSelections(next);
  }, [quiz.data]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const deadline = quiz.data?.deadline ? new Date(quiz.data.deadline).getTime() : null;
  const msRemaining = deadline !== null ? deadline - now : null;

  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  async function submit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      await api.submitStudentQuiz(quizId);
      toast.success("Quiz submitted");
      router.push("/portal/quizzes");
    } catch {
      toast.error("Failed to submit — please try again");
      submittedRef.current = false;
    } finally {
      setSubmitting(false);
    }
  }

  // Auto-submit once the time limit passes — the server-enforced
  // backstop is that saves are rejected past the deadline too; this is
  // the client doing its part to close the loop automatically.
  useEffect(() => {
    if (msRemaining !== null && msRemaining <= 0 && quiz.data) {
      submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msRemaining !== null && msRemaining <= 0]);

  async function saveAnswer(question: QuizTakingQuestion, selectedOptionIndex: number) {
    try {
      await api.saveStudentQuizAnswer(quizId, question.id, { selectedOptionIndex });
    } catch {
      toast.error("Failed to save your answer — check your connection");
    }
  }

  const answeredCount = useMemo(() => {
    if (!quiz.data) return 0;
    return quiz.data.questions.filter((q) => selections[q.id] !== undefined).length;
  }, [quiz.data, selections]);

  if (quiz.error) {
    return (
      <div className="max-w-2xl">
        <p className="text-destructive text-sm">
          This quiz isn&apos;t available right now — check with your teacher if you think this is wrong.
        </p>
      </div>
    );
  }

  if (!quiz.data) {
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
          <h1 className="text-2xl font-semibold">Quiz in progress</h1>
          <p className="text-muted-foreground text-sm">
            {answeredCount} of {quiz.data.questions.length} answered
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
        {quiz.data.questions.map((q, i) => (
          <Card key={q.id}>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                {i + 1}. {q.text}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {q.options.map((option, optionIndex) => (
                  <label key={optionIndex} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={q.id}
                      checked={selections[q.id] === optionIndex}
                      onChange={() => {
                        setSelections((s) => ({ ...s, [q.id]: optionIndex }));
                        saveAnswer(q, optionIndex);
                      }}
                    />
                    {option}
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        type="button"
        disabled={submitting}
        onClick={() => {
          if (window.confirm("Submit this quiz? You won't be able to change your answers after.")) {
            submit();
          }
        }}
      >
        {submitting ? "Submitting…" : "Submit quiz"}
      </Button>
    </div>
  );
}
