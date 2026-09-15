"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { api } from "@/lib/api";
import { StudentSummary } from "@/components/student-summary";

export default function GuardianPortalPage() {
  const children = useSWR("guardian-my-children", () => api.listMyChildren());
  const [studentId, setStudentId] = useState("");

  const list = children.data?.children ?? [];
  const selected = list.find((c) => c.student.id === studentId) ?? list[0];
  if (!studentId && selected) setStudentId(selected.student.id);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Children</h1>
        <p className="text-muted-foreground text-sm">
          Pick a child to see their active enrollment, attendance, and weekly timetable.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {!children.data ? "Loading…" : list.length === 0 ? "No children linked to this account" : "Child"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
          {selected ? <StudentSummary data={selected} /> : null}
        </CardContent>
      </Card>
    </div>
  );
}
