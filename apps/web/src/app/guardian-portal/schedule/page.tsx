"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { api } from "@/lib/api";
import { DAYS } from "@/components/student-summary";
import { todayLocalDateString } from "@/lib/local-date";

export default function GuardianScheduleForDatePage() {
  const children = useSWR("guardian-my-children", () => api.listMyChildren());
  const [studentId, setStudentId] = useState("");
  const [date, setDate] = useState(todayLocalDateString());

  const list = children.data?.children ?? [];
  if (!studentId && list.length > 0) setStudentId(list[0].student.id);

  const schedule = useSWR(
    studentId ? ["guardian-schedule", studentId, date] : null,
    () => api.getChildSchedule(studentId, date),
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Schedule</h1>
        <p className="text-muted-foreground text-sm">
          Pick a child and a date to see that day&apos;s classes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Classes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
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
            <Input type="date" className="w-40" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {!schedule.data || schedule.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No classes scheduled for this date.</p>
          ) : (
            <ul className="divide-y">
              {schedule.data.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>
                    {DAYS[entry.dayOfWeek]} · {entry.period.name} — {entry.teachingAssignment.subject.name} for{" "}
                    {entry.section ? entry.section.name : entry.teachingAssignment.program.name}{" "}
                    <span className="text-muted-foreground">
                      ({entry.teachingAssignment.employee.firstName} {entry.teachingAssignment.employee.lastName} ·{" "}
                      {entry.room.name})
                    </span>
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
