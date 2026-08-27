"use client";

import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { statusVariant } from "@/lib/status-variant";

// Consolidates AssignmentSubmission.score and KnowledgeCheckAttempt.
// score — two otherwise-disconnected grading shapes (per the LMS
// discovery pass) — into one page, reusing listStudentAssignments/
// listStudentQuizzes' existing data. No new backend endpoint.
export default function PortalGradesPage() {
  const assignments = useSWR("grades-assignments", () => api.listStudentAssignments());
  const quizzes = useSWR("grades-quizzes", () => api.listStudentQuizzes());

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Grades</h1>
        <p className="text-muted-foreground text-sm">Your assignment and quiz scores across your enrolled courses.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {!assignments.data ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : assignments.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No assignments yet.</p>
          ) : (
            <ul className="divide-y">
              {assignments.data.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">{a.title}</p>
                    <p className="text-muted-foreground text-xs">{a.teachingAssignment.subject.name}</p>
                  </div>
                  {a.mySubmission ? (
                    <Badge variant={statusVariant(a.mySubmission.status)}>
                      {a.mySubmission.status === "GRADED"
                        ? `${a.mySubmission.score}/${a.maxScore ?? "?"}`
                        : a.mySubmission.status}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Not submitted</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quizzes</CardTitle>
        </CardHeader>
        <CardContent>
          {!quizzes.data ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : quizzes.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No quizzes yet.</p>
          ) : (
            <ul className="divide-y">
              {quizzes.data.map((q) => (
                <li key={q.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">{q.title}</p>
                    <p className="text-muted-foreground text-xs">{q.teachingAssignment.subject.name}</p>
                  </div>
                  {q.myAttempt?.submittedAt ? (
                    <Badge variant="success">{q.myAttempt.score?.toFixed(0)}%</Badge>
                  ) : q.myAttempt?.startedAt ? (
                    <Badge variant="warning">In progress</Badge>
                  ) : (
                    <Badge variant="secondary">Not started</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
