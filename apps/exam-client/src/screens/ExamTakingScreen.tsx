import { useEffect, useMemo, useRef, useState } from "react";
import type { ExamTakingQuestion, ExamTakingState } from "@education-erp/api-client";
import type { SyncStatusEvent } from "../../electron/preload/types";

function formatCountdown(msRemaining: number): string {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

export function ExamTakingScreen({
  examSubjectId,
  onSubmitted,
}: {
  examSubjectId: string;
  onSubmitted: () => void;
}) {
  const [exam, setExam] = useState<ExamTakingState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [syncLabel, setSyncLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  useEffect(() => {
    window.examClient
      .startExam(examSubjectId)
      .then((state) => {
        setExam(state);
        const nextSelections: Record<string, number> = {};
        const nextTexts: Record<string, string> = {};
        for (const q of state.questions) {
          if (q.selectedOptionIndex !== undefined) nextSelections[q.id] = q.selectedOptionIndex;
          if (q.textAnswer !== undefined) nextTexts[q.id] = q.textAnswer;
        }
        setSelections(nextSelections);
        setTexts(nextTexts);
      })
      .catch(() => setLoadError(true));
  }, [examSubjectId]);

  useEffect(() => {
    return window.examClient.onSyncStatus((event: SyncStatusEvent) => {
      if (event.kind !== "answer") return;
      setSyncLabel(
        event.status === "saving"
          ? "Saving…"
          : event.status === "retrying"
            ? "Offline — retrying…"
            : event.status === "saved"
              ? "Saved"
              : event.status === "failed"
                ? "Couldn't save that answer"
                : "",
      );
    });
  }, []);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const deadline = exam ? new Date(exam.deadline).getTime() : null;
  const msRemaining = deadline !== null ? deadline - now : null;

  async function submit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      await window.examClient.submitExam(examSubjectId);
      onSubmitted();
    } catch {
      submittedRef.current = false;
      setSubmitting(false);
    }
  }

  // The one server-enforced backstop is that saves/starts are rejected
  // past the deadline too — this is the client doing its part to close
  // the loop automatically. submitExam itself keeps retrying through the
  // resilient-online retry queue if the connection is down right at the
  // deadline, rather than giving up.
  useEffect(() => {
    if (msRemaining !== null && msRemaining <= 0 && exam) {
      submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msRemaining !== null && msRemaining <= 0]);

  function saveAnswer(question: ExamTakingQuestion, input: { selectedOptionIndex?: number; textAnswer?: string }) {
    window.examClient.saveAnswer(examSubjectId, question.id, input).catch(() => undefined);
  }

  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  function saveTextDebounced(question: ExamTakingQuestion, value: string) {
    setTexts((t) => ({ ...t, [question.id]: value }));
    clearTimeout(debounceRef.current[question.id]);
    debounceRef.current[question.id] = setTimeout(() => saveAnswer(question, { textAnswer: value }), 800);
  }

  const answeredCount = useMemo(() => {
    if (!exam) return 0;
    return exam.questions.filter(
      (q) => selections[q.id] !== undefined || (texts[q.id] ?? "").trim().length > 0,
    ).length;
  }, [exam, selections, texts]);

  if (loadError) {
    return (
      <div className="screen centered">
        <p className="error">This exam isn&apos;t available right now.</p>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="screen centered">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="screen">
      <header className="topbar">
        <div>
          <strong>Exam in progress</strong>
          <p className="muted">
            {answeredCount} of {exam.questions.length} answered · {syncLabel}
          </p>
        </div>
        {msRemaining !== null ? (
          <div className="countdown">
            <p className="muted">Time remaining</p>
            <p className="countdown-value">{formatCountdown(msRemaining)}</p>
          </div>
        ) : null}
      </header>

      <div className="content">
        {exam.questions.map((q, i) => (
          <div key={q.id} className="card no-select" onContextMenu={(e) => e.preventDefault()} onCopy={(e) => e.preventDefault()}>
            <p className="question-text">
              {i + 1}. {q.text} <span className="muted">({q.marks} marks)</span>
            </p>
            {q.questionType === "OBJECTIVE" ? (
              <div className="options">
                {(q.options ?? []).map((option, optionIndex) => (
                  <label key={optionIndex} className="option">
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
                className="selectable"
                value={texts[q.id] ?? ""}
                onChange={(e) => saveTextDebounced(q, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={submitting}
        onClick={() => {
          if (window.confirm("Submit this exam? You won't be able to change your answers after.")) {
            submit();
          }
        }}
      >
        {submitting ? "Submitting…" : "Submit exam"}
      </button>
    </div>
  );
}
