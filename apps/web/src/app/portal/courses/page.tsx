"use client";

import Link from "next/link";
import useSWR from "swr";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";

export default function PortalCoursesPage() {
  // No studentId param — "enrolled" is derived server-side from the
  // caller's own active StudentEnrollment (section+term).
  const courses = useSWR("portal-courses", () => api.listStudentCourses());

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Courses</h1>
        <p className="text-muted-foreground text-sm">The courses you&apos;re currently enrolled in.</p>
      </div>

      <Card>
        <CardContent className="space-y-2 pt-6">
          {!courses.data ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : courses.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No courses yet — you may not have an active enrollment.</p>
          ) : (
            <ul className="divide-y">
              {courses.data.map((c) => (
                <li key={c.id} className="py-3">
                  <Link href={`/portal/courses/${c.id}`} className="font-medium underline-offset-4 hover:underline">
                    {c.subject.name}
                  </Link>
                  <p className="text-muted-foreground text-sm">
                    {c.employee.firstName} {c.employee.lastName} · {c.section.name} · {c.term.name}
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
