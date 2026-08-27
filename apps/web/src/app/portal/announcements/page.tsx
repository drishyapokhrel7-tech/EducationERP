"use client";

import useSWR from "swr";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";

export default function PortalAnnouncementsPage() {
  const announcements = useSWR("portal-announcements", () => api.listStudentAnnouncements());

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Announcements</h1>
        <p className="text-muted-foreground text-sm">Posts from your teachers across your enrolled courses.</p>
      </div>

      {!announcements.data || announcements.data.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">
              {!announcements.data ? "Loading…" : "No announcements yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.data.map((a) => (
            <Card key={a.id}>
              <CardContent className="space-y-1 pt-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-medium">{a.title}</h2>
                  <span className="text-muted-foreground text-xs">{new Date(a.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {a.teachingAssignment.subject.name} · {a.teachingAssignment.employee.firstName}{" "}
                  {a.teachingAssignment.employee.lastName}
                </p>
                <p className="mt-2 text-sm whitespace-pre-wrap">{a.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
