"use client";

import useSWR from "swr";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";

export default function PortalDiscussionsPage() {
  const topics = useSWR("portal-discussion-topics", () => api.listStudentDiscussionTopics());

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Discussions</h1>
        <p className="text-muted-foreground text-sm">Discussion topics across your enrolled courses.</p>
      </div>

      <Card>
        <CardContent className="space-y-2 pt-6">
          {!topics.data ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : topics.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No discussion topics yet.</p>
          ) : (
            <ul className="divide-y">
              {topics.data.map((t) => (
                <li key={t.id} className="py-3">
                  <Link href={`/portal/discussions/${t.id}`} className="font-medium underline-offset-4 hover:underline">
                    {t.title}
                  </Link>
                  <p className="text-muted-foreground text-sm">
                    {t.teachingAssignment.subject.name} · {t.teachingAssignment.employee.firstName}{" "}
                    {t.teachingAssignment.employee.lastName}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
