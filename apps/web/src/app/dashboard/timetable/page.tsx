"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { EntityCard } from "@/components/dashboard/entity-card";
import { api } from "@/lib/api";
import { submitAction } from "@/lib/submit-action";

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
];

export default function TimetablePage() {
  const campuses = useSWR("campuses", () => api.listCampuses());
  // Deliberately the unbounded, narrow picker — this is a "pick a
  // staff member" dropdown, not the paginated admin list view (Phase 8
  // performance-optimization slice).
  const employees = useSWR("employees-picker", () => api.listEmployeesPicker());
  const subjects = useSWR("subjects", () => api.listSubjects());
  const sections = useSWR("sections", () => api.listSections());
  const terms = useSWR("terms", () => api.listTerms());
  const rooms = useSWR("rooms", () => api.listRooms());
  const periods = useSWR("periods", () => api.listPeriods());
  const teachingAssignments = useSWR("teaching-assignments", () => api.listTeachingAssignments());
  const classSchedules = useSWR("class-schedules", () => api.listClassSchedules());

  const [roomForm, setRoomForm] = useState({ campusId: "", name: "", code: "", capacity: "", roomType: "" });
  const [periodForm, setPeriodForm] = useState({ name: "", code: "", sequence: "", startTime: "", endTime: "" });

  // Edit state, one per catalog entity on this page — a separate,
  // small inline form (rendered via EntityCard's `footer`) rather
  // than merging into the always-visible create form above, matching
  // the staff/page.tsx reference implementation.
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editRoomForm, setEditRoomForm] = useState({ campusId: "", name: "", code: "", capacity: "", roomType: "" });
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [editPeriodForm, setEditPeriodForm] = useState({ name: "", code: "", sequence: "", startTime: "", endTime: "" });
  const [assignmentForm, setAssignmentForm] = useState({
    employeeId: "",
    subjectId: "",
    sectionId: "",
    termId: "",
  });
  const [scheduleForm, setScheduleForm] = useState({
    teachingAssignmentId: "",
    roomId: "",
    periodId: "",
    dayOfWeek: "",
  });

  async function submit(action: () => Promise<unknown>, onSuccess: () => void) {
    try {
      await action();
      onSuccess();
      toast.success("Saved");
    } catch (err) {
      const message =
        err && typeof err === "object" && "body" in err
          ? ((err as { body?: { message?: string } }).body?.message ?? null)
          : null;
      toast.error(typeof message === "string" ? message : "Failed — check that required fields are filled in");
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Timetable</h1>
        <p className="text-muted-foreground text-sm">
          Rooms and periods define the slots. A teaching assignment pairs a teacher with a
          subject and section for a term; a schedule entry places that pairing into a
          day/period/room.
        </p>
      </div>

      <EntityCard
        title="Rooms"
        emptyLabel="No rooms yet."
        items={rooms.data}
        renderItem={(r: {
          id: string;
          campusId: string;
          name: string;
          code: string;
          capacity: number | null;
          roomType: string | null;
        }) => (
          <div className="flex items-center justify-between gap-2">
            <span>
              {r.name} <span className="text-muted-foreground">{r.code}</span>
              {r.roomType ? <span className="text-muted-foreground"> · {r.roomType}</span> : null}
              {r.capacity ? <span className="text-muted-foreground"> · capacity {r.capacity}</span> : null}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingRoomId(r.id);
                  setEditRoomForm({
                    campusId: r.campusId,
                    name: r.name,
                    code: r.code,
                    capacity: r.capacity != null ? String(r.capacity) : "",
                    roomType: r.roomType ?? "",
                  });
                }}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => submitAction(() => api.deleteRoom(r.id), () => rooms.mutate())}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
        footer={
          editingRoomId ? (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                submitAction(
                  () =>
                    api.updateRoom(editingRoomId, {
                      campusId: editRoomForm.campusId,
                      name: editRoomForm.name,
                      code: editRoomForm.code,
                      capacity: editRoomForm.capacity ? Number(editRoomForm.capacity) : undefined,
                      roomType: editRoomForm.roomType || undefined,
                    }),
                  () => {
                    setEditingRoomId(null);
                    rooms.mutate();
                  },
                );
              }}
            >
              <div className="space-y-2">
                <Label>Institution</Label>
                <NativeSelect
                  className="w-40"
                  placeholder="Select institution"
                  value={editRoomForm.campusId}
                  onChange={(v) => setEditRoomForm((f) => ({ ...f, campusId: v }))}
                  options={(campuses.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  required
                  value={editRoomForm.name}
                  onChange={(e) => setEditRoomForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  required
                  className="w-24"
                  value={editRoomForm.code}
                  onChange={(e) => setEditRoomForm((f) => ({ ...f, code: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Capacity (optional)</Label>
                <Input
                  type="number"
                  className="w-24"
                  value={editRoomForm.capacity}
                  onChange={(e) => setEditRoomForm((f) => ({ ...f, capacity: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Type (optional)</Label>
                <Input
                  className="w-28"
                  value={editRoomForm.roomType}
                  onChange={(e) => setEditRoomForm((f) => ({ ...f, roomType: e.target.value }))}
                />
              </div>
              <Button type="submit" size="sm">
                Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingRoomId(null)}>
                Cancel
              </Button>
            </form>
          ) : null
        }
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(
              () =>
                api.createRoom({
                  campusId: roomForm.campusId,
                  name: roomForm.name,
                  code: roomForm.code,
                  capacity: roomForm.capacity ? Number(roomForm.capacity) : undefined,
                  roomType: roomForm.roomType || undefined,
                }),
              () => {
                setRoomForm({ campusId: "", name: "", code: "", capacity: "", roomType: "" });
                rooms.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Institution</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select institution"
              value={roomForm.campusId}
              onChange={(v) => setRoomForm((f) => ({ ...f, campusId: v }))}
              options={(campuses.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              required
              value={roomForm.name}
              onChange={(e) => setRoomForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Code</Label>
            <Input
              required
              className="w-24"
              value={roomForm.code}
              onChange={(e) => setRoomForm((f) => ({ ...f, code: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Capacity (optional)</Label>
            <Input
              type="number"
              className="w-24"
              value={roomForm.capacity}
              onChange={(e) => setRoomForm((f) => ({ ...f, capacity: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Type (optional)</Label>
            <Input
              className="w-28"
              placeholder="Classroom"
              value={roomForm.roomType}
              onChange={(e) => setRoomForm((f) => ({ ...f, roomType: e.target.value }))}
            />
          </div>
          <Button type="submit" disabled={!roomForm.campusId}>
            Add
          </Button>
        </form>
      </EntityCard>

      <EntityCard
        title="Periods"
        emptyLabel="No periods yet."
        items={periods.data}
        renderItem={(p: { id: string; name: string; code: string; sequence: number; startTime: string; endTime: string }) => (
          <div className="flex items-center justify-between gap-2">
            <span>
              {p.name} <span className="text-muted-foreground">{p.code} · {p.startTime}–{p.endTime}</span>
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingPeriodId(p.id);
                  setEditPeriodForm({
                    name: p.name,
                    code: p.code,
                    sequence: String(p.sequence),
                    startTime: p.startTime,
                    endTime: p.endTime,
                  });
                }}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => submitAction(() => api.deletePeriod(p.id), () => periods.mutate())}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
        footer={
          editingPeriodId ? (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                submitAction(
                  () =>
                    api.updatePeriod(editingPeriodId, {
                      name: editPeriodForm.name,
                      code: editPeriodForm.code,
                      sequence: Number(editPeriodForm.sequence),
                      startTime: editPeriodForm.startTime,
                      endTime: editPeriodForm.endTime,
                    }),
                  () => {
                    setEditingPeriodId(null);
                    periods.mutate();
                  },
                );
              }}
            >
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  required
                  className="w-28"
                  value={editPeriodForm.name}
                  onChange={(e) => setEditPeriodForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  required
                  className="w-20"
                  value={editPeriodForm.code}
                  onChange={(e) => setEditPeriodForm((f) => ({ ...f, code: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Sequence</Label>
                <Input
                  required
                  type="number"
                  className="w-20"
                  value={editPeriodForm.sequence}
                  onChange={(e) => setEditPeriodForm((f) => ({ ...f, sequence: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Start (HH:mm)</Label>
                <Input
                  required
                  className="w-24"
                  value={editPeriodForm.startTime}
                  onChange={(e) => setEditPeriodForm((f) => ({ ...f, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>End (HH:mm)</Label>
                <Input
                  required
                  className="w-24"
                  value={editPeriodForm.endTime}
                  onChange={(e) => setEditPeriodForm((f) => ({ ...f, endTime: e.target.value }))}
                />
              </div>
              <Button type="submit" size="sm">
                Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingPeriodId(null)}>
                Cancel
              </Button>
            </form>
          ) : null
        }
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(
              () =>
                api.createPeriod({
                  name: periodForm.name,
                  code: periodForm.code,
                  sequence: Number(periodForm.sequence),
                  startTime: periodForm.startTime,
                  endTime: periodForm.endTime,
                }),
              () => {
                setPeriodForm({ name: "", code: "", sequence: "", startTime: "", endTime: "" });
                periods.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              required
              placeholder="Period 1"
              className="w-28"
              value={periodForm.name}
              onChange={(e) => setPeriodForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Code</Label>
            <Input
              required
              className="w-20"
              value={periodForm.code}
              onChange={(e) => setPeriodForm((f) => ({ ...f, code: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Sequence</Label>
            <Input
              required
              type="number"
              className="w-20"
              value={periodForm.sequence}
              onChange={(e) => setPeriodForm((f) => ({ ...f, sequence: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Start (HH:mm)</Label>
            <Input
              required
              placeholder="09:00"
              className="w-24"
              value={periodForm.startTime}
              onChange={(e) => setPeriodForm((f) => ({ ...f, startTime: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>End (HH:mm)</Label>
            <Input
              required
              placeholder="09:45"
              className="w-24"
              value={periodForm.endTime}
              onChange={(e) => setPeriodForm((f) => ({ ...f, endTime: e.target.value }))}
            />
          </div>
          <Button type="submit">Add</Button>
        </form>
      </EntityCard>

      <EntityCard
        title="Teaching assignments"
        emptyLabel="No teaching assignments yet."
        items={teachingAssignments.data}
        renderItem={(a: {
          employee: { firstName: string; lastName: string };
          subject: { name: string };
          section: { name: string };
          term: { name: string };
        }) => (
          <span>
            {a.employee.firstName} {a.employee.lastName} teaches {a.subject.name} to{" "}
            {a.section.name} <span className="text-muted-foreground">({a.term.name})</span>
          </span>
        )}
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(
              () => api.createTeachingAssignment(assignmentForm),
              () => {
                setAssignmentForm({ employeeId: "", subjectId: "", sectionId: "", termId: "" });
                teachingAssignments.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Teacher</Label>
            <NativeSelect
              className="w-40"
              placeholder="Select teacher"
              value={assignmentForm.employeeId}
              onChange={(v) => setAssignmentForm((f) => ({ ...f, employeeId: v }))}
              options={(employees.data ?? []).map((e) => ({
                value: e.id,
                label: `${e.firstName} ${e.lastName}`,
              }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            <NativeSelect
              className="w-36"
              placeholder="Select subject"
              value={assignmentForm.subjectId}
              onChange={(v) => setAssignmentForm((f) => ({ ...f, subjectId: v }))}
              options={(subjects.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Section</Label>
            <NativeSelect
              className="w-36"
              placeholder="Select section"
              value={assignmentForm.sectionId}
              onChange={(v) => setAssignmentForm((f) => ({ ...f, sectionId: v }))}
              options={(sections.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Term</Label>
            <NativeSelect
              className="w-36"
              placeholder="Select term"
              value={assignmentForm.termId}
              onChange={(v) => setAssignmentForm((f) => ({ ...f, termId: v }))}
              options={(terms.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
            />
          </div>
          <Button
            type="submit"
            disabled={
              !assignmentForm.employeeId ||
              !assignmentForm.subjectId ||
              !assignmentForm.sectionId ||
              !assignmentForm.termId
            }
          >
            Add
          </Button>
        </form>
      </EntityCard>

      <EntityCard
        title="Weekly schedule"
        emptyLabel="No schedule entries yet."
        items={classSchedules.data}
        renderItem={(c: {
          dayOfWeek: number;
          period: { name: string; startTime: string; endTime: string };
          room: { name: string };
          section: { name: string };
          teacher: { firstName: string; lastName: string };
          teachingAssignment: { subject: { name: string } };
        }) => (
          <span>
            {DAYS.find((d) => d.value === c.dayOfWeek)?.label} · {c.period.name} (
            {c.period.startTime}–{c.period.endTime}) — {c.teachingAssignment.subject.name} for{" "}
            {c.section.name} with {c.teacher.firstName} {c.teacher.lastName} in {c.room.name}
          </span>
        )}
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(
              () =>
                api.createClassSchedule({
                  teachingAssignmentId: scheduleForm.teachingAssignmentId,
                  roomId: scheduleForm.roomId,
                  periodId: scheduleForm.periodId,
                  dayOfWeek: Number(scheduleForm.dayOfWeek),
                }),
              () => {
                setScheduleForm({ teachingAssignmentId: "", roomId: "", periodId: "", dayOfWeek: "" });
                classSchedules.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Teaching assignment</Label>
            <NativeSelect
              className="w-56"
              placeholder="Select assignment"
              value={scheduleForm.teachingAssignmentId}
              onChange={(v) => setScheduleForm((f) => ({ ...f, teachingAssignmentId: v }))}
              options={(teachingAssignments.data ?? []).map((a) => ({
                value: a.id,
                label: `${a.subject.name} · ${a.section.name} · ${a.employee.firstName} ${a.employee.lastName}`,
              }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Day</Label>
            <NativeSelect
              className="w-32"
              placeholder="Select day"
              value={scheduleForm.dayOfWeek}
              onChange={(v) => setScheduleForm((f) => ({ ...f, dayOfWeek: v }))}
              options={DAYS.map((d) => ({ value: String(d.value), label: d.label }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Period</Label>
            <NativeSelect
              className="w-32"
              placeholder="Select period"
              value={scheduleForm.periodId}
              onChange={(v) => setScheduleForm((f) => ({ ...f, periodId: v }))}
              options={(periods.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Room</Label>
            <NativeSelect
              className="w-32"
              placeholder="Select room"
              value={scheduleForm.roomId}
              onChange={(v) => setScheduleForm((f) => ({ ...f, roomId: v }))}
              options={(rooms.data ?? []).map((r) => ({ value: r.id, label: r.name }))}
            />
          </div>
          <Button
            type="submit"
            disabled={
              !scheduleForm.teachingAssignmentId ||
              !scheduleForm.roomId ||
              !scheduleForm.periodId ||
              !scheduleForm.dayOfWeek
            }
          >
            Add
          </Button>
        </form>
      </EntityCard>
    </div>
  );
}
