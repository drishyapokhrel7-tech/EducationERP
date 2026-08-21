import { useEffect, useState } from "react";
import type { MyExamAttempt, SafeUser } from "@education-erp/api-client";

export function ExamListScreen({
  user,
  onStartExam,
  onLogout,
}: {
  user: SafeUser;
  onStartExam: (examSubjectId: string) => void;
  onLogout: () => void;
}) {
  const [exams, setExams] = useState<MyExamAttempt[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    window.examClient
      .listExams()
      .then(setExams)
      .catch(() => setError(true));
  }, []);

  return (
    <div className="screen">
      <header className="topbar">
        <div>
          <strong>
            {user.firstName} {user.lastName}
          </strong>
        </div>
        <button type="button" onClick={onLogout}>
          Log out
        </button>
      </header>
      <div className="content">
        <h1>Your exams</h1>
        {error ? <p className="error">Couldn&apos;t load your exams — check your connection.</p> : null}
        {!exams ? (
          <p className="muted">Loading…</p>
        ) : exams.length === 0 ? (
          <p className="muted">No exams available right now.</p>
        ) : (
          <ul className="exam-list">
            {exams.map((attempt) => (
              <li key={attempt.id} className="card">
                <div>
                  <strong>{attempt.examSubject.curriculumSubject.subject.name}</strong>
                  {attempt.examSubject.examSchedule ? (
                    <p className="muted">
                      {new Date(attempt.examSubject.examSchedule.date).toLocaleDateString()} ·{" "}
                      {attempt.examSubject.examSchedule.startTime}–{attempt.examSubject.examSchedule.endTime}
                    </p>
                  ) : (
                    <p className="muted">Not scheduled yet</p>
                  )}
                </div>
                {attempt.submittedAt ? (
                  <span className="muted">Submitted</span>
                ) : (
                  <button type="button" onClick={() => onStartExam(attempt.examSubjectId)}>
                    {attempt.startedAt ? "Resume" : "Start"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
