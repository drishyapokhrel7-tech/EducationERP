"use client";

import useSWR from "swr";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/lib/api";

export default function PortalExamsPage() {
  const exams = useSWR("my-exams", () => api.listMyExams());

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Exams</h1>
        <p className="text-muted-foreground text-sm">Exams you&apos;re registered to take online.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Exams</CardTitle>
        </CardHeader>
        <CardContent>
          {!exams.data || exams.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No exams available yet.</p>
          ) : (
            <ul className="divide-y">
              {exams.data.map((a) => {
                const label = a.submittedAt ? "Submitted" : a.startedAt ? "Resume" : "Start";
                return (
                  <li key={a.id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p className="font-medium">{a.examSubject.curriculumSubject.subject.name}</p>
                      {a.examSubject.examSchedule ? (
                        <p className="text-muted-foreground text-xs">
                          {new Date(a.examSubject.examSchedule.date).toLocaleDateString()} ·{" "}
                          {a.examSubject.examSchedule.startTime}–{a.examSubject.examSchedule.endTime}
                        </p>
                      ) : (
                        <p className="text-muted-foreground text-xs">Not scheduled yet</p>
                      )}
                    </div>
                    {a.submittedAt ? (
                      <span className="text-muted-foreground text-xs">Submitted</span>
                    ) : (
                      <Link href={`/portal/exams/${a.examSubjectId}`} className={buttonVariants({ size: "sm" })}>
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
