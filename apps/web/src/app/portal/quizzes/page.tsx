"use client";

import useSWR from "swr";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/lib/api";

export default function PortalQuizzesPage() {
  const quizzes = useSWR("my-quizzes", () => api.listStudentQuizzes());

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Quizzes</h1>
        <p className="text-muted-foreground text-sm">Published quizzes across your enrolled courses.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quizzes</CardTitle>
        </CardHeader>
        <CardContent>
          {!quizzes.data || quizzes.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No quizzes available yet.</p>
          ) : (
            <ul className="divide-y">
              {quizzes.data.map((q) => {
                const label = q.myAttempt?.startedAt ? "Resume" : "Start";
                return (
                  <li key={q.id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p className="font-medium">{q.title}</p>
                      <p className="text-muted-foreground text-xs">
                        {q.teachingAssignment.subject.name} · {q.questionCount} question
                        {q.questionCount === 1 ? "" : "s"}
                        {q.durationMinutes ? ` · ${q.durationMinutes} min` : ""}
                      </p>
                    </div>
                    {q.myAttempt?.submittedAt ? (
                      <span className="text-muted-foreground text-xs">Score: {q.myAttempt.score?.toFixed(0)}%</span>
                    ) : (
                      <Link href={`/portal/quizzes/${q.id}`} className={buttonVariants({ size: "sm" })}>
                        {label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
