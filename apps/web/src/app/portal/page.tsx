"use client";

import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { StudentSummary } from "@/components/student-summary";

export default function PortalPage() {
  // No studentId param — the server derives it from the logged-in
  // user's own linked Student row.
  const dashboard = useSWR("portal-dashboard", () => api.getPortalDashboard());

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Your timetable, attendance, assignments and syllabus progress.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{dashboard.data ? `${dashboard.data.student.firstName} ${dashboard.data.student.lastName}` : "Loading…"}</CardTitle>
        </CardHeader>
        <CardContent>
          {!dashboard.data ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <StudentSummary data={dashboard.data} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
