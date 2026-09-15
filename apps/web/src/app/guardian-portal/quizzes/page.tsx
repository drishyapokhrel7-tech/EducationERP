"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { api } from "@/lib/api";

export default function GuardianQuizzesPage() {
  const children = useSWR("guardian-my-children", () => api.listMyChildren());
  const [studentId, setStudentId] = useState("");

  const list = children.data?.children ?? [];
  if (!studentId && list.length > 0) setStudentId(list[0].student.id);

  const quizzes = useSWR(studentId ? ["guardian-quizzes", studentId] : null, () => api.listChildQuizzes(studentId));

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Quizzes</h1>
        <p className="text-muted-foreground text-sm">
          Published quizzes across your child&apos;s courses — view only, your child takes these themselves.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quizzes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {list.length > 0 ? (
            <NativeSelect
              className="w-64"
              placeholder="Select a child"
              value={studentId}
              onChange={setStudentId}
              options={list.map((c) => ({
                value: c.student.id,
                label: `${c.student.firstName} ${c.student.lastName} (${c.relationship})`,
              }))}
            />
          ) : null}
          {!quizzes.data || quizzes.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No quizzes available yet.</p>
          ) : (
            <ul className="divide-y">
              {quizzes.data.map((q) => (
                <li key={q.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium">{q.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {q.teachingAssignment.subject.name} · {q.questionCount} question
                      {q.questionCount === 1 ? "" : "s"}
                      {q.durationMinutes ? ` · ${q.durationMinutes} min` : ""}
                    </p>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {q.childAttempt?.submittedAt
                      ? `Score: ${q.childAttempt.score?.toFixed(0)}%`
                      : q.childAttempt?.startedAt
                        ? "In progress"
                        : "Not started"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
