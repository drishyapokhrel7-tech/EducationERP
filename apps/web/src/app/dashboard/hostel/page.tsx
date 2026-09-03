"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { PageSubNav } from "@/components/dashboard/page-subnav";
import { FeatureLock } from "@/components/feature-lock";
import { api } from "@/lib/api";
import { statusVariant } from "@/lib/status-variant";
import { submitAction, submitDelete } from "@/lib/submit-action";
import type { HostelLookupKind, HostelLookupRecord, StudentEnrollment } from "@education-erp/api-client";

// A plain free-text Input let the same real value get typo'd a dozen
// ways across data entry (room type, visitor relation, complaint
// category). This sources its options from the org's own
// HostelLookup catalog for that `kind` and lets the picker add a new
// standard value inline — the field itself keeps storing a plain
// string (see the HostelLookup schema comment), this just makes sure
// everyone picks from the same list.
function LookupSelect({
  kind,
  value,
  onChange,
  options,
  onCreated,
  placeholder,
  className,
}: {
  kind: HostelLookupKind;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  onCreated: () => void;
  placeholder: string;
  className?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState("");

  if (adding) {
    return (
      <div className="flex items-end gap-1">
        <div className="space-y-1">
          <Label className="text-xs">New {placeholder.toLowerCase()}</Label>
          <Input className={className ?? "w-32"} value={newValue} onChange={(e) => setNewValue(e.target.value)} autoFocus />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!newValue.trim()}
          onClick={() =>
            submitAction(
              () => api.createHostelLookup({ kind, name: newValue.trim() }),
              () => {
                onChange(newValue.trim());
                setNewValue("");
                setAdding(false);
                onCreated();
              },
            )
          }
        >
          Add
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <NativeSelect
      className={className}
      placeholder={placeholder}
      value={value}
      onChange={(v) => (v === "__add_new__" ? setAdding(true) : onChange(v))}
      options={[...options.map((o) => ({ value: o, label: o })), { value: "__add_new__", label: "+ Add new…" }]}
    />
  );
}

// Edit/Delete UI for one HostelLookup kind's catalog. Not an
// EntityCard (this page doesn't use that component) — a small
// self-contained list matching the Card/ul/li shape the rest of this
// page uses, with its own editing state since three of these render
// side by side on one page. Only `name` is editable (see
// UpdateHostelLookupInput) and delete has no dependency guard on the
// backend for this entity, by design — nothing extra needed here for
// that, the existing error-toast path covers any failure regardless.
function LookupManageList({
  title,
  data,
  mutate,
}: {
  title: string;
  data: HostelLookupRecord[] | undefined;
  mutate: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "" });

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium">{title}</p>
      {!data || data.length === 0 ? (
        <p className="text-muted-foreground text-xs">None yet.</p>
      ) : (
        <ul className="divide-y text-sm">
          {data.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 py-2">
              <span>{l.name}</span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingId(l.id);
                    setEditForm({ name: l.name });
                  }}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => submitDelete(() => api.deleteHostelLookup(l.id), () => mutate())}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editingId ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submitAction(() => api.updateHostelLookup(editingId, editForm), () => {
              setEditingId(null);
              mutate();
            });
          }}
        >
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input className="h-7 w-40" value={editForm.name} onChange={(e) => setEditForm({ name: e.target.value })} />
          </div>
          <Button type="submit" size="sm" className="h-7" disabled={!editForm.name}>
            Save
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => setEditingId(null)}>
            Cancel
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export default function HostelPage() {
  // Deliberately the unbounded, narrow picker — this is a "pick a
  // student" dropdown, not the paginated admin list view (Phase 8
  // performance-optimization slice).
  const students = useSWR("students-picker", () => api.listStudentsPicker());
  const hostels = useSWR("hostels", () => api.listHostels());
  const vacantBeds = useSWR("hostel-vacant-beds", () => api.listVacantHostelBeds());
  const allocations = useSWR("hostel-allocations", () => api.listHostelAllocations());
  const complaints = useSWR("hostel-complaints", () => api.listHostelComplaints());
  const maintenance = useSWR("hostel-maintenance", () => api.listHostelMaintenanceRequests());
  const roomTypeLookups = useSWR("hostel-lookups-room-type", () => api.listHostelLookups("ROOM_TYPE"));
  const relationLookups = useSWR("hostel-lookups-relation", () => api.listHostelLookups("VISITOR_RELATION"));
  const categoryLookups = useSWR("hostel-lookups-category", () => api.listHostelLookups("COMPLAINT_CATEGORY"));

  // ── Hostels ───────────────────────────────────────────────────────
  const [hostelForm, setHostelForm] = useState({ name: "", code: "", address: "" });

  // ── Buildings ─────────────────────────────────────────────────────
  const [buildingHostelId, setBuildingHostelId] = useState("");
  const [buildingForm, setBuildingForm] = useState({ name: "", code: "" });

  // ── Rooms & beds ──────────────────────────────────────────────────
  const [roomBuildingId, setRoomBuildingId] = useState("");
  const [roomForm, setRoomForm] = useState({ roomNumber: "", roomType: "" });
  const [bedRoomId, setBedRoomId] = useState("");
  const [bedForm, setBedForm] = useState({ label: "" });

  const selectedBuilding = hostels.data?.flatMap((h) => h.buildings).find((b) => b.id === roomBuildingId);
  const allRooms = hostels.data?.flatMap((h) => h.buildings.flatMap((b) => b.rooms)) ?? [];

  // ── Allocation ────────────────────────────────────────────────────
  const [allocStudentId, setAllocStudentId] = useState("");
  const [studentEnrollments, setStudentEnrollments] = useState<StudentEnrollment[]>([]);
  const [allocForm, setAllocForm] = useState({ studentEnrollmentId: "", bedId: "" });

  // ── Attendance / visitors / complaints, per selected allocation ────
  const [selectedAllocationId, setSelectedAllocationId] = useState("");
  const attendance = useSWR(
    selectedAllocationId ? ["hostel-attendance", selectedAllocationId] : null,
    () => api.listHostelAttendance(selectedAllocationId),
  );
  const visitors = useSWR(
    selectedAllocationId ? ["hostel-visitors", selectedAllocationId] : null,
    () => api.listHostelVisitors(selectedAllocationId),
  );
  const [attendanceForm, setAttendanceForm] = useState({ date: "", status: "PRESENT" as "PRESENT" | "ABSENT" | "ON_LEAVE" });
  const [visitorForm, setVisitorForm] = useState({ visitorName: "", relation: "" });

  // ── Complaint / maintenance status updates ─────────────────────────
  const [complaintNotes, setComplaintNotes] = useState<Record<string, string>>({});
  const [maintenanceForm, setMaintenanceForm] = useState({ roomId: "", description: "" });
  const [complaintForm, setComplaintForm] = useState({ category: "", description: "" });

  return (
    <FeatureLock feature="hostel">
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Hostel</h1>
        <p className="text-muted-foreground text-sm">
          Hostels, buildings, rooms, beds, student allocation, attendance, visitors, complaints, and maintenance. Hostel
          fees are billed through Finance&apos;s existing fee structures — assign one to an allocated student&apos;s
          enrollment the same way any other fee is assigned.
        </p>
      </div>

      <PageSubNav
        sections={[
          { id: "lookups", label: "Lookups" },
          { id: "hostels", label: "Hostels" },
          { id: "buildings", label: "Buildings" },
          { id: "rooms-beds", label: "Rooms & beds" },
          { id: "allocations", label: "Allocations" },
          { id: "complaints", label: "Complaints" },
          { id: "maintenance", label: "Maintenance" },
        ]}
      />

      <Card id="lookups" className="scroll-mt-16">
        <CardHeader>
          <CardTitle>Lookups</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-xs">
            Standard values for room type, visitor relation, and complaint category — new ones can also be added
            inline from the &quot;+ Add new…&quot; option wherever these are picked below.
          </p>
          <LookupManageList title="Room types" data={roomTypeLookups.data} mutate={roomTypeLookups.mutate} />
          <LookupManageList title="Visitor relations" data={relationLookups.data} mutate={relationLookups.mutate} />
          <LookupManageList
            title="Complaint categories"
            data={categoryLookups.data}
            mutate={categoryLookups.mutate}
          />
        </CardContent>
      </Card>

      <Card id="hostels" className="scroll-mt-16">
        <CardHeader>
          <CardTitle>Hostels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hostels.data || hostels.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No hostels yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {hostels.data.map((h) => (
                <li key={h.id} className="py-2">
                  <span className="font-medium">{h.name}</span> <span className="text-muted-foreground">({h.code})</span>
                  {h.address ? <span className="text-muted-foreground"> — {h.address}</span> : null}
                  <span className="text-muted-foreground">
                    {" "}
                    · {h.buildings.length} building{h.buildings.length === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Separator />
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submitAction(() => api.createHostel(hostelForm), () => {
                setHostelForm({ name: "", code: "", address: "" });
                hostels.mutate();
              });
            }}
          >
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input className="w-40" value={hostelForm.name} onChange={(e) => setHostelForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Code</Label>
              <Input className="w-28" value={hostelForm.code} onChange={(e) => setHostelForm((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Address (optional)</Label>
              <Input
                className="w-48"
                value={hostelForm.address}
                onChange={(e) => setHostelForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <Button type="submit" size="sm" disabled={!hostelForm.name || !hostelForm.code}>
              Add hostel
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card id="buildings" className="scroll-mt-16">
        <CardHeader>
          <CardTitle>Buildings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <NativeSelect
            className="w-56"
            placeholder="Select a hostel"
            value={buildingHostelId}
            onChange={setBuildingHostelId}
            options={(hostels.data ?? []).map((h) => ({ value: h.id, label: h.name }))}
          />
          {buildingHostelId ? (
            <>
              {(hostels.data?.find((h) => h.id === buildingHostelId)?.buildings.length ?? 0) === 0 ? (
                <p className="text-muted-foreground text-sm">No buildings yet.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {hostels.data
                    ?.find((h) => h.id === buildingHostelId)
                    ?.buildings.map((b) => (
                      <li key={b.id} className="py-2">
                        <span className="font-medium">{b.name}</span> <span className="text-muted-foreground">({b.code})</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {b.rooms.length} room{b.rooms.length === 1 ? "" : "s"}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
              <Separator />
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  submitAction(
                    () => api.createHostelBuilding({ hostelId: buildingHostelId, ...buildingForm }),
                    () => {
                      setBuildingForm({ name: "", code: "" });
                      hostels.mutate();
                    },
                  );
                }}
              >
                <div className="space-y-1">
                  <Label className="text-xs">Building name</Label>
                  <Input
                    className="w-40"
                    value={buildingForm.name}
                    onChange={(e) => setBuildingForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Code</Label>
                  <Input
                    className="w-28"
                    value={buildingForm.code}
                    onChange={(e) => setBuildingForm((f) => ({ ...f, code: e.target.value }))}
                  />
                </div>
                <Button type="submit" size="sm" disabled={!buildingForm.name || !buildingForm.code}>
                  Add building
                </Button>
              </form>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card id="rooms-beds" className="scroll-mt-16">
        <CardHeader>
          <CardTitle>Rooms &amp; beds</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <NativeSelect
            className="w-56"
            placeholder="Select a building"
            value={roomBuildingId}
            onChange={(v) => {
              setRoomBuildingId(v);
              setBedRoomId("");
            }}
            options={(hostels.data ?? []).flatMap((h) => h.buildings).map((b) => ({ value: b.id, label: b.name }))}
          />
          {roomBuildingId ? (
            <>
              {!selectedBuilding || selectedBuilding.rooms.length === 0 ? (
                <p className="text-muted-foreground text-sm">No rooms yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {selectedBuilding.rooms.map((r) => (
                    <li key={r.id} className="rounded-md border p-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          Room {r.roomNumber} {r.roomType ? <span className="text-muted-foreground">({r.roomType})</span> : null}
                        </span>
                        <Button type="button" size="sm" variant="outline" onClick={() => setBedRoomId(r.id)}>
                          Add bed here
                        </Button>
                      </div>
                      {r.beds.length === 0 ? (
                        <p className="text-muted-foreground text-xs">No beds yet.</p>
                      ) : (
                        <ul className="mt-1 flex flex-wrap gap-2 text-xs">
                          {r.beds.map((bed) => (
                            <li key={bed.id}>
                              <Badge variant={bed.status === "MAINTENANCE" ? "destructive" : "secondary"}>
                                {bed.label} — {bed.status}
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <Separator />
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  submitAction(
                    () => api.createHostelRoom({ buildingId: roomBuildingId, ...roomForm }),
                    () => {
                      setRoomForm({ roomNumber: "", roomType: "" });
                      hostels.mutate();
                    },
                  );
                }}
              >
                <div className="space-y-1">
                  <Label className="text-xs">Room number</Label>
                  <Input
                    className="w-28"
                    value={roomForm.roomNumber}
                    onChange={(e) => setRoomForm((f) => ({ ...f, roomNumber: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Room type (optional)</Label>
                  <LookupSelect
                    kind="ROOM_TYPE"
                    className="w-32"
                    placeholder="Room type"
                    value={roomForm.roomType}
                    onChange={(v) => setRoomForm((f) => ({ ...f, roomType: v }))}
                    options={(roomTypeLookups.data ?? []).map((l) => l.name)}
                    onCreated={() => roomTypeLookups.mutate()}
                  />
                </div>
                <Button type="submit" size="sm" disabled={!roomForm.roomNumber}>
                  Add room
                </Button>
              </form>
              {bedRoomId ? (
                <form
                  className="flex flex-wrap items-end gap-3 rounded-md border p-2"
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    submitAction(
                      () => api.createHostelBed({ roomId: bedRoomId, ...bedForm }),
                      () => {
                        setBedForm({ label: "" });
                        hostels.mutate();
                        vacantBeds.mutate();
                      },
                    );
                  }}
                >
                  <div className="space-y-1">
                    <Label className="text-xs">
                      New bed label for room {allRooms.find((r) => r.id === bedRoomId)?.roomNumber}
                    </Label>
                    <Input className="w-24" value={bedForm.label} onChange={(e) => setBedForm({ label: e.target.value })} />
                  </div>
                  <Button type="submit" size="sm" disabled={!bedForm.label}>
                    Add bed
                  </Button>
                </form>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card id="allocations" className="scroll-mt-16">
        <CardHeader>
          <CardTitle>Allocations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!allocations.data || allocations.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No students allocated yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {allocations.data.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    {a.studentEnrollment.student.firstName} {a.studentEnrollment.student.lastName} —{" "}
                    {a.bed.room.building.hostel.name} / {a.bed.room.building.name} / Room {a.bed.room.roomNumber} / Bed{" "}
                    {a.bed.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => setSelectedAllocationId(a.id)}>
                      Attendance / visitors
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        submitAction(
                          () => api.unallocateHostelBed(a.studentEnrollmentId),
                          () => {
                            allocations.mutate();
                            vacantBeds.mutate();
                          },
                        )
                      }
                    >
                      Unassign
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Separator />
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submitAction(() => api.allocateHostelBed(allocForm), () => {
                setAllocStudentId("");
                setStudentEnrollments([]);
                setAllocForm({ studentEnrollmentId: "", bedId: "" });
                allocations.mutate();
                vacantBeds.mutate();
              });
            }}
          >
            <div className="space-y-1">
              <Label className="text-xs">Student</Label>
              <NativeSelect
                className="w-48"
                placeholder="Select student"
                value={allocStudentId}
                onChange={(v) => {
                  setAllocStudentId(v);
                  setAllocForm((f) => ({ ...f, studentEnrollmentId: "" }));
                  if (v) api.listEnrollments(v).then(setStudentEnrollments);
                }}
                options={(students.data ?? []).map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName} (${s.studentCode})` }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Enrollment</Label>
              <NativeSelect
                className="w-40"
                placeholder="Select enrollment"
                value={allocForm.studentEnrollmentId}
                onChange={(v) => setAllocForm((f) => ({ ...f, studentEnrollmentId: v }))}
                options={studentEnrollments.map((en) => ({ value: en.id, label: en.term.name }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vacant bed</Label>
              <NativeSelect
                className="w-56"
                placeholder="Select a bed"
                value={allocForm.bedId}
                onChange={(v) => setAllocForm((f) => ({ ...f, bedId: v }))}
                options={(vacantBeds.data ?? []).map((b) => ({
                  value: b.id,
                  label: `${b.room.building.hostel.name} / ${b.room.building.name} / Room ${b.room.roomNumber} / Bed ${b.label}`,
                }))}
              />
            </div>
            <Button type="submit" size="sm" disabled={!allocForm.studentEnrollmentId || !allocForm.bedId}>
              Allocate
            </Button>
          </form>

          {selectedAllocationId ? (
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">
                Attendance &amp; visitors for{" "}
                {allocations.data?.find((a) => a.id === selectedAllocationId)?.studentEnrollment.student.firstName}{" "}
                {allocations.data?.find((a) => a.id === selectedAllocationId)?.studentEnrollment.student.lastName}
              </p>

              <div className="space-y-2">
                <p className="text-xs font-medium">Attendance</p>
                {!attendance.data || attendance.data.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No attendance recorded yet.</p>
                ) : (
                  <ul className="text-xs">
                    {attendance.data.map((rec) => (
                      <li key={rec.id}>
                        {new Date(rec.date).toLocaleDateString()} — <Badge variant={statusVariant(rec.status)}>{rec.status}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    submitAction(
                      () => api.markHostelAttendance(selectedAllocationId, attendanceForm),
                      () => {
                        setAttendanceForm({ date: "", status: "PRESENT" });
                        attendance.mutate();
                      },
                    );
                  }}
                >
                  <Input
                    type="date"
                    className="h-7 w-36"
                    value={attendanceForm.date}
                    onChange={(e) => setAttendanceForm((f) => ({ ...f, date: e.target.value }))}
                  />
                  <NativeSelect
                    className="h-7 w-28"
                    placeholder="Status"
                    value={attendanceForm.status}
                    onChange={(v) => setAttendanceForm((f) => ({ ...f, status: v as typeof attendanceForm.status }))}
                    options={[
                      { value: "PRESENT", label: "Present" },
                      { value: "ABSENT", label: "Absent" },
                      { value: "ON_LEAVE", label: "On leave" },
                    ]}
                  />
                  <Button type="submit" size="sm" className="h-7" disabled={!attendanceForm.date}>
                    Mark
                  </Button>
                </form>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium">Visitors</p>
                {!visitors.data || visitors.data.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No visitors logged yet.</p>
                ) : (
                  <ul className="text-xs">
                    {visitors.data.map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-2">
                        <span>
                          {v.visitorName} {v.relation ? `(${v.relation})` : ""} — in {new Date(v.checkInAt).toLocaleTimeString()}
                          {v.checkOutAt ? `, out ${new Date(v.checkOutAt).toLocaleTimeString()}` : ""}
                        </span>
                        {!v.checkOutAt ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-6"
                            onClick={() => submitAction(() => api.logHostelVisitorOut(v.id), () => visitors.mutate())}
                          >
                            Check out
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    submitAction(
                      () => api.logHostelVisitorIn(selectedAllocationId, visitorForm),
                      () => {
                        setVisitorForm({ visitorName: "", relation: "" });
                        visitors.mutate();
                      },
                    );
                  }}
                >
                  <Input
                    className="h-7 w-32"
                    placeholder="Visitor name"
                    value={visitorForm.visitorName}
                    onChange={(e) => setVisitorForm((f) => ({ ...f, visitorName: e.target.value }))}
                  />
                  <LookupSelect
                    kind="VISITOR_RELATION"
                    className="h-7 w-28"
                    placeholder="Relation"
                    value={visitorForm.relation}
                    onChange={(v) => setVisitorForm((f) => ({ ...f, relation: v }))}
                    options={(relationLookups.data ?? []).map((l) => l.name)}
                    onCreated={() => relationLookups.mutate()}
                  />
                  <Button type="submit" size="sm" className="h-7" disabled={!visitorForm.visitorName}>
                    Log in
                  </Button>
                </form>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium">Raise a complaint</p>
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    submitAction(
                      () => api.createHostelComplaint(selectedAllocationId, complaintForm),
                      () => {
                        setComplaintForm({ category: "", description: "" });
                        complaints.mutate();
                      },
                    );
                  }}
                >
                  <LookupSelect
                    kind="COMPLAINT_CATEGORY"
                    className="h-7 w-28"
                    placeholder="Category"
                    value={complaintForm.category}
                    onChange={(v) => setComplaintForm((f) => ({ ...f, category: v }))}
                    options={(categoryLookups.data ?? []).map((l) => l.name)}
                    onCreated={() => categoryLookups.mutate()}
                  />
                  <Input
                    className="h-7 w-48"
                    placeholder="Description"
                    value={complaintForm.description}
                    onChange={(e) => setComplaintForm((f) => ({ ...f, description: e.target.value }))}
                  />
                  <Button type="submit" size="sm" className="h-7" disabled={!complaintForm.category || !complaintForm.description}>
                    Raise
                  </Button>
                </form>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card id="complaints" className="scroll-mt-16">
        <CardHeader>
          <CardTitle>Complaints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!complaints.data || complaints.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No complaints yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {complaints.data.map((c) => (
                <li key={c.id} className="rounded-md border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      <span className="font-medium">{c.category}</span> — {c.description}{" "}
                      <span className="text-muted-foreground">
                        ({c.hostelAllocation.studentEnrollment.student.firstName}{" "}
                        {c.hostelAllocation.studentEnrollment.student.lastName})
                      </span>
                    </span>
                    <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                  </div>
                  {c.status !== "RESOLVED" ? (
                    <form
                      className="mt-2 flex flex-wrap items-end gap-2"
                      onSubmit={(e: FormEvent) => {
                        e.preventDefault();
                        submitAction(
                          () =>
                            api.updateHostelComplaint(c.id, {
                              status: "RESOLVED",
                              resolutionNotes: complaintNotes[c.id] || undefined,
                            }),
                          () => complaints.mutate(),
                        );
                      }}
                    >
                      <Input
                        className="h-7 w-48"
                        placeholder="Resolution notes"
                        value={complaintNotes[c.id] ?? ""}
                        onChange={(e) => setComplaintNotes((m) => ({ ...m, [c.id]: e.target.value }))}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() =>
                          submitAction(() => api.updateHostelComplaint(c.id, { status: "IN_PROGRESS" }), () => complaints.mutate())
                        }
                      >
                        Mark in progress
                      </Button>
                      <Button type="submit" size="sm" className="h-7">
                        Resolve
                      </Button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card id="maintenance" className="scroll-mt-16">
        <CardHeader>
          <CardTitle>Maintenance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!maintenance.data || maintenance.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No maintenance requests yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {maintenance.data.map((m) => (
                <li key={m.id} className="rounded-md border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      {m.room.building.hostel.name} / {m.room.building.name} / Room {m.room.roomNumber} — {m.description}
                    </span>
                    <Badge variant={statusVariant(m.status)}>{m.status}</Badge>
                  </div>
                  {m.status !== "RESOLVED" ? (
                    <div className="mt-2 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() =>
                          submitAction(() => api.updateHostelMaintenanceRequest(m.id, { status: "IN_PROGRESS" }), () => maintenance.mutate())
                        }
                      >
                        Mark in progress
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7"
                        onClick={() =>
                          submitAction(() => api.updateHostelMaintenanceRequest(m.id, { status: "RESOLVED" }), () => maintenance.mutate())
                        }
                      >
                        Resolve
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <Separator />
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submitAction(() => api.createHostelMaintenanceRequest(maintenanceForm), () => {
                setMaintenanceForm({ roomId: "", description: "" });
                maintenance.mutate();
              });
            }}
          >
            <div className="space-y-1">
              <Label className="text-xs">Room</Label>
              <NativeSelect
                className="w-56"
                placeholder="Select a room"
                value={maintenanceForm.roomId}
                onChange={(v) => setMaintenanceForm((f) => ({ ...f, roomId: v }))}
                options={allRooms.map((r) => ({ value: r.id, label: r.roomNumber }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input
                className="w-48"
                value={maintenanceForm.description}
                onChange={(e) => setMaintenanceForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <Button type="submit" size="sm" disabled={!maintenanceForm.roomId || !maintenanceForm.description}>
              Report
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
    </FeatureLock>
  );
}
