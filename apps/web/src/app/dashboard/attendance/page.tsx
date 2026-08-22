"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { EntityCard } from "@/components/dashboard/entity-card";
import { api } from "@/lib/api";
import { statusVariant } from "@/lib/status-variant";
import type { AttendanceStatus, StaffAttendanceStatus } from "@education-erp/api-client";

const DAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "LATE", label: "Late" },
  { value: "EXCUSED", label: "Excused" },
];

const STAFF_STATUS_OPTIONS: { value: StaffAttendanceStatus; label: string }[] = [
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "LATE", label: "Late" },
  { value: "ON_LEAVE", label: "On leave" },
  { value: "HALF_DAY", label: "Half day" },
];

export default function AttendancePage() {
  const sessions = useSWR("attendance-sessions", () => api.listAttendanceSessions());
  const classSchedules = useSWR("class-schedules", () => api.listClassSchedules());
  const employees = useSWR("employees", () => api.listEmployees());
  const staffAttendance = useSWR("staff-attendance", () => api.listStaffAttendance());

  const [sessionForm, setSessionForm] = useState({ classScheduleId: "", date: "" });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const activeSession = useSWR(
    activeSessionId ? ["attendance-session", activeSessionId] : null,
    () => api.getAttendanceSession(activeSessionId as string),
  );
  const [marks, setMarks] = useState<Record<string, { status: AttendanceStatus; remarks: string }>>({});
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [correctionForm, setCorrectionForm] = useState({ status: "PRESENT" as AttendanceStatus, reason: "" });

  const [staffForm, setStaffForm] = useState({ employeeId: "", date: "", status: "PRESENT" as StaffAttendanceStatus, remarks: "" });

  function errorMessage(err: unknown, fallback: string) {
    const message =
      err && typeof err === "object" && "body" in err
        ? ((err as { body?: { message?: string } }).body?.message ?? null)
        : null;
    return typeof message === "string" ? message : fallback;
  }

  async function submit(action: () => Promise<unknown>, onSuccess: () => void) {
    try {
      await action();
      onSuccess();
      toast.success("Saved");
    } catch (err) {
      toast.error(errorMessage(err, "Failed — check that required fields are filled in"));
    }
  }

  function openSession(sessionId: string) {
    setActiveSessionId(sessionId);
    setMarks({});
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Attendance</h1>
        <p className="text-muted-foreground text-sm">
          Open a class schedule for a date to take attendance for its enrolled students. Staff
          attendance is tracked separately below.
        </p>
      </div>

      <EntityCard
        title="Class sessions"
        emptyLabel="No sessions taken yet."
        items={sessions.data}
        renderItem={(s: {
          id: string;
          date: string;
          section: { name: string };
          classSchedule: {
            dayOfWeek: number;
            period: { name: string };
            teachingAssignment: { subject: { name: string } };
          };
          studentAttendance: unknown[];
        }) => (
          <button
            type="button"
            className="hover:text-primary text-left"
            onClick={() => openSession(s.id)}
          >
            {new Date(s.date).toLocaleDateString()} — {s.classSchedule.teachingAssignment.subject.name}{" "}
            for {s.section.name}{" "}
            <span className="text-muted-foreground">
              ({DAYS[s.classSchedule.dayOfWeek]} · {s.classSchedule.period.name}) ·{" "}
              {s.studentAttendance.length} marked
            </span>
          </button>
        )}
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={async (e: FormEvent) => {
            e.preventDefault();
            try {
              const created = await api.createAttendanceSession(sessionForm);
              setSessionForm({ classScheduleId: "", date: "" });
              sessions.mutate();
              openSession(created.id);
              toast.success("Saved");
            } catch (err) {
              toast.error(errorMessage(err, "Failed to open session"));
            }
          }}
        >
          <div className="space-y-2">
            <Label>Class schedule</Label>
            <NativeSelect
              className="w-64"
              placeholder="Select schedule"
              value={sessionForm.classScheduleId}
              onChange={(v) => setSessionForm((f) => ({ ...f, classScheduleId: v }))}
              options={(classSchedules.data ?? []).map((c) => ({
                value: c.id,
                label: `${DAYS[c.dayOfWeek]} ${c.period.name} · ${c.teachingAssignment.subject.name} · ${c.section.name}`,
              }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              required
              type="date"
              value={sessionForm.date}
              onChange={(e) => setSessionForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <Button type="submit" disabled={!sessionForm.classScheduleId || !sessionForm.date}>
            Open session
          </Button>
        </form>
      </EntityCard>

      {activeSessionId ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Mark attendance
              {activeSession.data ? (
                <span className="text-muted-foreground ml-2 text-sm font-normal">
                  {new Date(activeSession.data.date).toLocaleDateString()} ·{" "}
                  {activeSession.data.section.name}
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeSession.data ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : activeSession.data.roster.length === 0 ? (
              <p className="text-muted-foreground text-sm">No students enrolled in this section.</p>
            ) : (
              <ul className="divide-y">
                {activeSession.data.roster.map((student) => {
                  const existing = activeSession.data?.studentAttendance.find(
                    (a) => a.studentId === student.id,
                  );
                  const current = marks[student.id]?.status ?? existing?.status ?? "PRESENT";
                  return (
                    <li key={student.id} className="py-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span>
                          {student.firstName} {student.lastName}{" "}
                          <span className="text-muted-foreground">{student.studentCode}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          {existing ? <Badge variant={statusVariant(existing.status)}>{existing.status}</Badge> : null}
                          <NativeSelect
                            className="w-32"
                            placeholder="Status"
                            value={current}
                            onChange={(v) =>
                              setMarks((m) => ({
                                ...m,
                                [student.id]: { status: v as AttendanceStatus, remarks: m[student.id]?.remarks ?? "" },
                              }))
                            }
                            options={STATUS_OPTIONS}
                          />
                          {existing ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8"
                              onClick={() => {
                                setCorrecting(correcting === student.id ? null : student.id);
                                setCorrectionForm({ status: existing.status, reason: "" });
                              }}
                            >
                              Correct
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      {correcting === student.id ? (
                        <div className="bg-muted/50 mt-2 flex flex-wrap items-end gap-2 rounded-lg p-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Corrected status</Label>
                            <NativeSelect
                              className="w-32"
                              placeholder="Status"
                              value={correctionForm.status}
                              onChange={(v) =>
                                setCorrectionForm((f) => ({ ...f, status: v as AttendanceStatus }))
                              }
                              options={STATUS_OPTIONS}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Reason</Label>
                            <Input
                              className="w-48"
                              value={correctionForm.reason}
                              onChange={(e) => setCorrectionForm((f) => ({ ...f, reason: e.target.value }))}
                            />
                          </div>
                          <Button
                            type="button"
                            className="h-8"
                            disabled={!correctionForm.reason}
                            onClick={() => {
                              if (!activeSessionId) return;
                              submit(
                                () => api.correctAttendance(activeSessionId, student.id, correctionForm),
                                () => {
                                  setCorrecting(null);
                                  activeSession.mutate();
                                },
                              );
                            }}
                          >
                            Submit correction
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            <Button
              type="button"
              disabled={!activeSession.data || activeSession.data.roster.length === 0}
              onClick={() => {
                if (!activeSessionId || !activeSession.data) return;
                const entries = activeSession.data.roster.map((student) => ({
                  studentId: student.id,
                  status:
                    marks[student.id]?.status ??
                    activeSession.data?.studentAttendance.find((a) => a.studentId === student.id)?.status ??
                    ("PRESENT" as AttendanceStatus),
                }));
                submit(
                  () => api.markAttendance(activeSessionId, { entries }),
                  () => {
                    activeSession.mutate();
                    sessions.mutate();
                  },
                );
              }}
            >
              Save attendance
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <EntityCard
        title="Staff attendance"
        emptyLabel="No staff attendance recorded yet."
        items={staffAttendance.data}
        renderItem={(a: { employee: { firstName: string; lastName: string }; date: string; status: string }) => (
          <span className="flex items-center gap-2">
            {a.employee.firstName} {a.employee.lastName} —{" "}
            <span className="text-muted-foreground">{new Date(a.date).toLocaleDateString()}</span>
            <Badge variant={statusVariant(a.status)}>{a.status}</Badge>
          </span>
        )}
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(
              () => api.markStaffAttendance({ ...staffForm, remarks: staffForm.remarks || undefined }),
              () => {
                setStaffForm({ employeeId: "", date: "", status: "PRESENT", remarks: "" });
                staffAttendance.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Employee</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select employee"
              value={staffForm.employeeId}
              onChange={(v) => setStaffForm((f) => ({ ...f, employeeId: v }))}
              options={(employees.data ?? []).map((e) => ({
                value: e.id,
                label: `${e.firstName} ${e.lastName}`,
              }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              required
              type="date"
              value={staffForm.date}
              onChange={(e) => setStaffForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <NativeSelect
              className="w-32"
              placeholder="Status"
              value={staffForm.status}
              onChange={(v) => setStaffForm((f) => ({ ...f, status: v as StaffAttendanceStatus }))}
              options={STAFF_STATUS_OPTIONS}
            />
          </div>
          <div className="space-y-2">
            <Label>Remarks (optional)</Label>
            <Input
              className="w-40"
              value={staffForm.remarks}
              onChange={(e) => setStaffForm((f) => ({ ...f, remarks: e.target.value }))}
            />
          </div>
          <Button type="submit" disabled={!staffForm.employeeId || !staffForm.date}>
            Mark
          </Button>
        </form>
      </EntityCard>
    </div>
  );
}
