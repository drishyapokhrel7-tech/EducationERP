"use client";

import Link from "next/link";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { statusVariant } from "@/lib/status-variant";

export default function PortalAssignmentsPage() {
  const assignments = useSWR("portal-assignments", () => api.listStudentAssignments());

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Assignments</h1>
        <p className="text-muted-foreground text-sm">Published assignments across your enrolled courses.</p>
      </div>

      <Card>
        <CardContent className="space-y-2 pt-6">
          {!assignments.data ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : assignments.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No assignments yet.</p>
          ) : (
            <ul className="divide-y">
              {assignments.data.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <Link href={`/portal/assignments/${a.id}`} className="font-medium underline-offset-4 hover:underline">
                      {a.title}
                    </Link>
                    <p className="text-muted-foreground text-sm">
                      {a.teachingAssignment.subject.name}
                      {a.dueDate ? ` · due ${new Date(a.dueDate).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  {a.mySubmission ? (
                    <Badge variant={statusVariant(a.mySubmission.status)}>
                      {a.mySubmission.status === "GRADED" ? `${a.mySubmission.score}/${a.maxScore ?? "?"}` : a.mySubmission.status}
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
    </div>
  );
}
