"use client";

import { useState } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { statusVariant } from "@/lib/status-variant";
import { DAYS, StudentSummary } from "@/components/student-summary";

export default function LearningDashboardsPage() {
  const employees = useSWR("employees", () => api.listEmployees());
  const students = useSWR("students", () => api.listStudents());
  const guardians = useSWR("guardians", () => api.listGuardians());

  const [teacherId, setTeacherId] = useState("");
  const teacherDashboard = useSWR(teacherId ? ["teacher-dashboard", teacherId] : null, () => api.getTeacherDashboard(teacherId));

  const [studentId, setStudentId] = useState("");
  const studentDashboard = useSWR(studentId ? ["student-dashboard", studentId] : null, () => api.getStudentDashboard(studentId));

  const [guardianId, setGuardianId] = useState("");
  const parentDashboard = useSWR(guardianId ? ["parent-dashboard", guardianId] : null, () => api.getParentDashboard(guardianId));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Learning Dashboards</h1>
        <p className="text-muted-foreground text-sm">
          Aggregate views over timetable, attendance, syllabus progress, assignments and knowledge
          checks — an admin-facing look at what a teacher, student or parent would see once their
          own portals exist.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Teacher dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Teacher</Label>
            <NativeSelect
              className="w-56"
              placeholder="Select teacher"
              value={teacherId}
              onChange={setTeacherId}
              options={(employees.data ?? []).map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }))}
            />
          </div>
          {teacherId ? (
            !teacherDashboard.data ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium">Teaching assignments</p>
                  {teacherDashboard.data.teachingAssignments.length === 0 ? (
                    <p className="text-muted-foreground">None yet.</p>
                  ) : (
                    <ul className="text-muted-foreground list-disc pl-5">
                      {teacherDashboard.data.teachingAssignments.map((t) => (
                        <li key={t.id}>
                          {t.subject.name} · {t.section.name} · {t.term.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="font-medium">Weekly timetable</p>
                  {teacherDashboard.data.classSchedules.length === 0 ? (
                    <p className="text-muted-foreground">No scheduled classes.</p>
                  ) : (
                    <ul className="text-muted-foreground list-disc pl-5">
                      {teacherDashboard.data.classSchedules.map((c) => (
                        <li key={c.id}>
                          {DAYS[c.dayOfWeek]} · {c.period.name} — {c.teachingAssignment.subject.name} for{" "}
                          {c.section.name} in {c.room.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="font-medium">Pending grading</p>
                  {teacherDashboard.data.pendingGrading.length === 0 ? (
                    <p className="text-muted-foreground">Nothing pending.</p>
                  ) : (
                    <ul className="text-muted-foreground list-disc pl-5">
                      {teacherDashboard.data.pendingGrading.map((p) => (
                        <li key={p.id}>
                          {p.assignmentTitle} — {p.student.firstName} {p.student.lastName}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="font-medium">Recent class sessions</p>
                  {teacherDashboard.data.recentClassSessions.length === 0 ? (
                    <p className="text-muted-foreground">None recorded yet.</p>
                  ) : (
                    <ul className="text-muted-foreground list-disc pl-5">
                      {teacherDashboard.data.recentClassSessions.map((c) => (
                        <li key={c.id}>
                          <span className="inline-flex flex-wrap items-center gap-2">
                            {new Date(c.date).toLocaleDateString()} · {c.section.name}
                            <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                            {c.actualSyllabusNode ? c.actualSyllabusNode.name : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="font-medium">Own attendance</p>
                  <p className="text-muted-foreground">
                    {teacherDashboard.data.staffAttendanceSummary.total === 0
                      ? "No attendance recorded yet."
                      : `${teacherDashboard.data.staffAttendanceSummary.present} present, ${teacherDashboard.data.staffAttendanceSummary.absent} absent, ${teacherDashboard.data.staffAttendanceSummary.late} late, ${teacherDashboard.data.staffAttendanceSummary.onLeave} on leave`}
                  </p>
                </div>
              </div>
            )
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Student dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Student</Label>
            <NativeSelect
              className="w-56"
              placeholder="Select student"
              value={studentId}
              onChange={setStudentId}
              options={(students.data ?? []).map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }))}
            />
          </div>
          {studentId ? (
            !studentDashboard.data ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : (
              <>
                <Separator />
                <StudentSummary data={studentDashboard.data} />
              </>
            )
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parent dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Guardian</Label>
            <NativeSelect
              className="w-56"
              placeholder="Select guardian"
              value={guardianId}
              onChange={setGuardianId}
              options={(guardians.data ?? []).map((g) => ({ value: g.id, label: `${g.firstName} ${g.lastName}` }))}
            />
          </div>
          {guardianId ? (
            !parentDashboard.data ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : parentDashboard.data.children.length === 0 ? (
              <p className="text-muted-foreground text-sm">No linked children.</p>
            ) : (
              <div className="space-y-4">
                {parentDashboard.data.children.map((child) => (
                  <div key={child.student.id}>
                    <Separator className="mb-3" />
                    <p className="mb-2 text-sm font-medium">
                      {child.student.firstName} {child.student.lastName}{" "}
                      <span className="text-muted-foreground">({child.relationship})</span>
                    </p>
                    <StudentSummary data={child} />
                  </div>
                ))}
              </div>
            )
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
