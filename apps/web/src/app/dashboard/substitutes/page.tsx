"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { ListPager } from "@/components/dashboard/list-pager";
import { api } from "@/lib/api";
import { submitAction, submitDelete } from "@/lib/submit-action";
import { todayLocalDateString } from "@/lib/local-date";
import type { SubstituteSlot } from "@education-erp/api-client";

// One slot's assign/reassign control — candidates are fetched per slot
// (not all at once) since availability depends on that exact
// day+period, same reasoning as the substitute-candidates endpoint
// itself being scoped to one classScheduleId.
function SlotRow({ slot, date, onAssigned }: { slot: SubstituteSlot; date: string; onAssigned: () => void }) {
  const candidates = useSWR(["substitute-candidates", slot.id, date], () => api.listAvailableSubstitutes(slot.id, date));
  const [selected, setSelected] = useState("");

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
      <div>
        <span className="font-medium">
          {slot.teachingAssignment.subject.name} — {slot.teachingAssignment.program.name}
          {slot.section ? ` · ${slot.section.name}` : ""}
        </span>
        <p className="text-muted-foreground text-xs">
          {slot.period.name} ({slot.period.startTime}–{slot.period.endTime}) · {slot.room.name} · Regular teacher:{" "}
          {slot.teacher.firstName} {slot.teacher.lastName} (absent)
        </p>
      </div>
      <div className="flex items-center gap-2">
        {slot.existingAssignment ? (
          <span className="text-sm">
            Covered by {slot.existingAssignment.substituteEmployee.firstName} {slot.existingAssignment.substituteEmployee.lastName}
          </span>
        ) : null}
        <NativeSelect
          className="h-8 w-48"
          placeholder={slot.existingAssignment ? "Reassign to…" : "Select substitute"}
          value={selected}
          onChange={setSelected}
          options={(candidates.data ?? []).map((c) => ({
            value: c.id,
            label: `${c.firstName} ${c.lastName} (${c.employeeCode})`,
          }))}
        />
        <Button
          type="button"
          size="sm"
          disabled={!selected}
          onClick={() =>
            submitAction(
              () => api.createSubstituteAssignment({ classScheduleId: slot.id, date, substituteEmployeeId: selected }),
              () => {
                setSelected("");
                onAssigned();
              },
            )
          }
        >
          {slot.existingAssignment ? "Reassign" : "Assign"}
        </Button>
      </div>
    </li>
  );
}

export default function SubstitutesPage() {
  const [date, setDate] = useState(todayLocalDateString());
  const needs = useSWR(["substitute-needs", date], () => api.listAbsentTeacherSlots(date));

  const [historyPage, setHistoryPage] = useState(1);
  const [historyDate, setHistoryDate] = useState("");
  const history = useSWR(["substitute-history", historyPage, historyDate], () =>
    api.listSubstituteAssignments({ page: historyPage, date: historyDate || undefined }),
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Substitute Teachers</h1>
        <p className="text-muted-foreground text-sm">
          Every scheduled period for a teacher marked absent or on approved leave that day, with a pick of who else is
          actually free to cover it.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coverage needed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-3">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" className="w-44" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <Separator />
          {!needs.data ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : needs.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No absent teachers with scheduled classes on this date.</p>
          ) : (
            <ul className="divide-y">
              {needs.data.map((slot) => (
                <SlotRow key={slot.id} slot={slot} date={date} onAssigned={() => needs.mutate()} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Substitution history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-3">
            <div className="space-y-2">
              <Label>Filter by date</Label>
              <Input
                type="date"
                className="w-44"
                value={historyDate}
                onChange={(e) => {
                  setHistoryDate(e.target.value);
                  setHistoryPage(1);
                }}
              />
            </div>
          </div>
          <Separator />
          {!history.data || history.data.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No substitutions recorded yet.</p>
          ) : (
            <ul className="divide-y">
              {history.data.data.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    {new Date(row.date).toLocaleDateString()} — {row.classSchedule?.teachingAssignment.subject.name}
                    {row.classSchedule?.section ? ` · ${row.classSchedule.section.name}` : ""} · {row.classSchedule?.period.name}
                    <br />
                    <span className="text-muted-foreground text-xs">
                      Regular: {row.classSchedule?.teacher.firstName} {row.classSchedule?.teacher.lastName} → Substitute:{" "}
                      {row.substituteEmployee.firstName} {row.substituteEmployee.lastName}
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => submitDelete(() => api.deleteSubstituteAssignment(row.id), () => history.mutate())}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {history.data ? (
            <ListPager
              page={history.data.page}
              totalPages={history.data.totalPages}
              onPrev={() => setHistoryPage((p) => Math.max(1, p - 1))}
              onNext={() => setHistoryPage((p) => p + 1)}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
