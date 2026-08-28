"use client";

import { useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { useHighlightFromSearch } from "@/lib/use-highlight-from-search";
import { submitAction, submitDelete, errorMessage } from "@/lib/submit-action";
import type { StudentEnrollment } from "@education-erp/api-client";

const LiveTrackingMap = dynamic(
  () => import("@/components/transport/live-tracking-map").then((m) => m.LiveTrackingMap),
  { ssr: false },
);

export default function TransportPage() {
  // Deliberately the unbounded, narrow picker — this is a "pick a
  // staff member" dropdown, not the paginated admin list view (Phase 8
  // performance-optimization slice).
  const employees = useSWR("employees-picker", () => api.listEmployeesPicker());
  // Deliberately the unbounded, narrow picker — this is a "pick a
  // student" dropdown, not the paginated admin list view (Phase 8
  // performance-optimization slice).
  const students = useSWR("students-picker", () => api.listStudentsPicker());
  const vehicles = useSWR("vehicles", () => api.listVehicles());
  useHighlightFromSearch(Boolean(vehicles.data));
  const drivers = useSWR("drivers", () => api.listDrivers());
  const routes = useSWR("routes", () => api.listRoutes());
  const assignments = useSWR("transport-assignments", () => api.listStudentTransportAssignments());

  // ── Vehicles ──────────────────────────────────────────────────────
  const [vehicleForm, setVehicleForm] = useState({ registrationNumber: "", type: "", capacity: "" });

  // ── Drivers ───────────────────────────────────────────────────────
  const [driverForm, setDriverForm] = useState({ employeeId: "", licenseNumber: "", licenseExpiry: "" });
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [editDriverForm, setEditDriverForm] = useState({ employeeId: "", licenseNumber: "", licenseExpiry: "" });
  // Keyed by employeeId, same per-row pattern as the students page's
  // create-login form.
  const [driverLoginPasswordForms, setDriverLoginPasswordForms] = useState<Record<string, string>>({});
  const [driverCreatedUsernames, setDriverCreatedUsernames] = useState<Record<string, string>>({});

  async function handleCreateDriverLogin(employeeId: string) {
    const password = driverLoginPasswordForms[employeeId] ?? "";
    try {
      const result = await api.createEmployeeLogin(employeeId, { password });
      setDriverCreatedUsernames((m) => ({ ...m, [employeeId]: result.username }));
      setDriverLoginPasswordForms((f) => ({ ...f, [employeeId]: "" }));
      drivers.mutate();
      employees.mutate();
      toast.success("Login created");
    } catch {
      toast.error("Failed to create login — password must be at least 8 characters");
    }
  }

  // ── Routes ────────────────────────────────────────────────────────
  const [routeForm, setRouteForm] = useState({ name: "", code: "", vehicleId: "", driverId: "" });
  const [routeStops, setRouteStops] = useState([
    { name: "", sequence: "1", arrivalOffsetMinutes: "", latitude: "", longitude: "" },
  ]);

  // ── Student assignment ────────────────────────────────────────────
  const [assignStudentId, setAssignStudentId] = useState("");
  const [studentEnrollments, setStudentEnrollments] = useState<StudentEnrollment[]>([]);
  const [assignForm, setAssignForm] = useState({ studentEnrollmentId: "", routeId: "", stopId: "" });

  const selectedRouteStops = routes.data?.find((r) => r.id === assignForm.routeId)?.stops ?? [];

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Transport</h1>
        <p className="text-muted-foreground text-sm">Vehicles, drivers, routes and stops, and student transport assignment.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vehicles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!vehicles.data || vehicles.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No vehicles yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {vehicles.data.map((v) => (
                <li id={`vehicle-${v.id}`} key={v.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {v.registrationNumber} <span className="text-muted-foreground">— {v.type} · {v.capacity} seats</span>
                  </span>
                  <Badge variant={v.status === "ACTIVE" ? "success" : v.status === "MAINTENANCE" ? "warning" : "destructive"}>{v.status}</Badge>
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
                () =>
                  api.createVehicle({
                    registrationNumber: vehicleForm.registrationNumber,
                    type: vehicleForm.type,
                    capacity: Number(vehicleForm.capacity),
                  }),
                () => {
                  setVehicleForm({ registrationNumber: "", type: "", capacity: "" });
                  vehicles.mutate();
                },
              );
            }}
          >
            <div className="space-y-1">
              <Label className="text-xs">Registration number</Label>
              <Input
                className="w-40"
                value={vehicleForm.registrationNumber}
                onChange={(e) => setVehicleForm((f) => ({ ...f, registrationNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Input className="w-32" value={vehicleForm.type} onChange={(e) => setVehicleForm((f) => ({ ...f, type: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Capacity</Label>
              <Input
                type="number"
                className="w-24"
                value={vehicleForm.capacity}
                onChange={(e) => setVehicleForm((f) => ({ ...f, capacity: e.target.value }))}
              />
            </div>
            <Button type="submit" size="sm" disabled={!vehicleForm.registrationNumber || !vehicleForm.type || !vehicleForm.capacity}>
              Add vehicle
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Drivers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!drivers.data || drivers.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No drivers yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {drivers.data.map((d) => (
                <li key={d.id} className="py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      {d.employee.firstName} {d.employee.lastName}{" "}
                      <span className="text-muted-foreground">
                        — license {d.licenseNumber}, expires {new Date(d.licenseExpiry).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingDriverId(d.id);
                          setEditDriverForm({
                            employeeId: d.employeeId,
                            licenseNumber: d.licenseNumber,
                            licenseExpiry: d.licenseExpiry.slice(0, 10),
                          });
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => submitDelete(() => api.deleteDriver(d.id), () => drivers.mutate())}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  {d.employee.userId ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Driver login: {driverCreatedUsernames[d.employeeId] ?? "created"}
                    </p>
                  ) : (
                    <form
                      className="mt-2 flex items-end gap-2"
                      onSubmit={(e: FormEvent) => {
                        e.preventDefault();
                        handleCreateDriverLogin(d.employeeId);
                      }}
                    >
                      <Input
                        type="password"
                        className="h-7 w-40"
                        placeholder="Set initial password"
                        value={driverLoginPasswordForms[d.employeeId] ?? ""}
                        onChange={(e) =>
                          setDriverLoginPasswordForms((f) => ({ ...f, [d.employeeId]: e.target.value }))
                        }
                      />
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        className="h-7"
                        disabled={(driverLoginPasswordForms[d.employeeId] ?? "").length < 8}
                      >
                        Create driver login
                      </Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          {editingDriverId ? (
            <form
              className="flex flex-wrap items-end gap-3 rounded-md border p-2"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                submitAction(
                  () => api.updateDriver(editingDriverId, editDriverForm),
                  () => {
                    setEditingDriverId(null);
                    drivers.mutate();
                  },
                );
              }}
            >
              <div className="space-y-1">
                <Label className="text-xs">Employee</Label>
                <NativeSelect
                  className="w-48"
                  placeholder="Select employee"
                  value={editDriverForm.employeeId}
                  onChange={(v) => setEditDriverForm((f) => ({ ...f, employeeId: v }))}
                  options={(employees.data ?? []).map((e) => ({
                    value: e.id,
                    label: `${e.firstName} ${e.lastName} (${e.employeeCode})`,
                  }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">License number</Label>
                <Input
                  className="w-36"
                  value={editDriverForm.licenseNumber}
                  onChange={(e) => setEditDriverForm((f) => ({ ...f, licenseNumber: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">License expiry</Label>
                <Input
                  type="date"
                  className="w-36"
                  value={editDriverForm.licenseExpiry}
                  onChange={(e) => setEditDriverForm((f) => ({ ...f, licenseExpiry: e.target.value }))}
                />
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={!editDriverForm.employeeId || !editDriverForm.licenseNumber || !editDriverForm.licenseExpiry}
              >
                Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingDriverId(null)}>
                Cancel
              </Button>
            </form>
          ) : null}
          <Separator />
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submitAction(() => api.createDriver(driverForm), () => {
                setDriverForm({ employeeId: "", licenseNumber: "", licenseExpiry: "" });
                drivers.mutate();
              });
            }}
          >
            <div className="space-y-1">
              <Label className="text-xs">Employee</Label>
              <NativeSelect
                className="w-48"
                placeholder="Select employee"
                value={driverForm.employeeId}
                onChange={(v) => setDriverForm((f) => ({ ...f, employeeId: v }))}
                options={(employees.data ?? []).map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName} (${e.employeeCode})` }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">License number</Label>
              <Input
                className="w-36"
                value={driverForm.licenseNumber}
                onChange={(e) => setDriverForm((f) => ({ ...f, licenseNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">License expiry</Label>
              <Input
                type="date"
                className="w-36"
                value={driverForm.licenseExpiry}
                onChange={(e) => setDriverForm((f) => ({ ...f, licenseExpiry: e.target.value }))}
              />
            </div>
            <Button type="submit" size="sm" disabled={!driverForm.employeeId || !driverForm.licenseNumber || !driverForm.licenseExpiry}>
              Add driver
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Routes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!routes.data || routes.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No routes yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {routes.data.map((r) => (
                <li key={r.id} className="py-2">
                  <p className="font-medium">
                    {r.name} <span className="text-muted-foreground font-normal">({r.code})</span>
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {r.vehicle ? r.vehicle.registrationNumber : "No vehicle"} ·{" "}
                    {r.driver ? `${r.driver.firstName} ${r.driver.lastName}` : "No driver"}
                  </p>
                  {r.stops.length > 0 ? (
                    <ul className="text-muted-foreground pl-4 text-xs">
                      {r.stops.map((s) => (
                        <li key={s.id}>
                          {s.sequence}. {s.name}
                          {s.arrivalOffsetMinutes != null ? ` (+${s.arrivalOffsetMinutes}m)` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <Separator />
          <form
            className="space-y-3"
            onSubmit={async (e: FormEvent) => {
              e.preventDefault();
              try {
                const route = await api.createRoute({
                  name: routeForm.name,
                  code: routeForm.code,
                  vehicleId: routeForm.vehicleId || undefined,
                  driverId: routeForm.driverId || undefined,
                });
                for (const stop of routeStops) {
                  if (stop.name) {
                    await api.addStop(route.id, {
                      name: stop.name,
                      sequence: Number(stop.sequence),
                      arrivalOffsetMinutes: stop.arrivalOffsetMinutes ? Number(stop.arrivalOffsetMinutes) : undefined,
                      latitude: stop.latitude ? Number(stop.latitude) : undefined,
                      longitude: stop.longitude ? Number(stop.longitude) : undefined,
                    });
                  }
                }
                setRouteForm({ name: "", code: "", vehicleId: "", driverId: "" });
                setRouteStops([{ name: "", sequence: "1", arrivalOffsetMinutes: "", latitude: "", longitude: "" }]);
                routes.mutate();
                toast.success("Saved");
              } catch (err) {
                toast.error(errorMessage(err, "Failed"));
              }
            }}
          >
            <p className="text-sm font-medium">New route</p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input className="w-40" value={routeForm.name} onChange={(e) => setRouteForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Code</Label>
                <Input className="w-24" value={routeForm.code} onChange={(e) => setRouteForm((f) => ({ ...f, code: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vehicle</Label>
                <NativeSelect
                  className="w-40"
                  placeholder="No vehicle"
                  value={routeForm.vehicleId}
                  onChange={(v) => setRouteForm((f) => ({ ...f, vehicleId: v }))}
                  options={(vehicles.data ?? []).map((v) => ({ value: v.id, label: v.registrationNumber }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Driver</Label>
                <NativeSelect
                  className="w-40"
                  placeholder="No driver"
                  value={routeForm.driverId}
                  onChange={(v) => setRouteForm((f) => ({ ...f, driverId: v }))}
                  options={(drivers.data ?? []).map((d) => ({ value: d.employeeId, label: `${d.employee.firstName} ${d.employee.lastName}` }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              {routeStops.map((stop, idx) => (
                <div key={idx} className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Stop name</Label>
                    <Input
                      className="w-40"
                      value={stop.name}
                      onChange={(e) => setRouteStops((rows) => rows.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r)))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Order</Label>
                    <Input
                      type="number"
                      className="w-20"
                      value={stop.sequence}
                      onChange={(e) => setRouteStops((rows) => rows.map((r, i) => (i === idx ? { ...r, sequence: e.target.value } : r)))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">+minutes</Label>
                    <Input
                      type="number"
                      className="w-24"
                      value={stop.arrivalOffsetMinutes}
                      onChange={(e) =>
                        setRouteStops((rows) => rows.map((r, i) => (i === idx ? { ...r, arrivalOffsetMinutes: e.target.value } : r)))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Latitude</Label>
                    <Input
                      type="number"
                      step="any"
                      className="w-28"
                      placeholder="optional"
                      value={stop.latitude}
                      onChange={(e) => setRouteStops((rows) => rows.map((r, i) => (i === idx ? { ...r, latitude: e.target.value } : r)))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Longitude</Label>
                    <Input
                      type="number"
                      step="any"
                      className="w-28"
                      placeholder="optional"
                      value={stop.longitude}
                      onChange={(e) => setRouteStops((rows) => rows.map((r, i) => (i === idx ? { ...r, longitude: e.target.value } : r)))}
                    />
                  </div>
                  {routeStops.length > 1 ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => setRouteStops((rows) => rows.filter((_, i) => i !== idx))}>
                      Remove
                    </Button>
                  ) : null}
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setRouteStops((rows) => [
                    ...rows,
                    { name: "", sequence: String(rows.length + 1), arrivalOffsetMinutes: "", latitude: "", longitude: "" },
                  ])
                }
              >
                Add stop
              </Button>
            </div>
            <Button type="submit" size="sm" disabled={!routeForm.name || !routeForm.code}>
              Create route
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Student Assignment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!assignments.data || assignments.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No students assigned yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {assignments.data.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {a.studentEnrollment.student.firstName} {a.studentEnrollment.student.lastName}{" "}
                    <span className="text-muted-foreground">
                      — {a.route.name} / {a.stop.name}
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      submitAction(() => api.unassignStudentTransport(a.studentEnrollmentId), () => assignments.mutate())
                    }
                  >
                    Unassign
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Separator />
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submitAction(() => api.assignStudentTransport(assignForm), () => {
                setAssignStudentId("");
                setStudentEnrollments([]);
                setAssignForm({ studentEnrollmentId: "", routeId: "", stopId: "" });
                assignments.mutate();
              });
            }}
          >
            <div className="space-y-1">
              <Label className="text-xs">Student</Label>
              <NativeSelect
                className="w-48"
                placeholder="Select student"
                value={assignStudentId}
                onChange={(v) => {
                  setAssignStudentId(v);
                  setAssignForm((f) => ({ ...f, studentEnrollmentId: "" }));
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
                value={assignForm.studentEnrollmentId}
                onChange={(v) => setAssignForm((f) => ({ ...f, studentEnrollmentId: v }))}
                options={studentEnrollments.map((en) => ({ value: en.id, label: `${en.term.name}` }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Route</Label>
              <NativeSelect
                className="w-40"
                placeholder="Select route"
                value={assignForm.routeId}
                onChange={(v) => setAssignForm((f) => ({ ...f, routeId: v, stopId: "" }))}
                options={(routes.data ?? []).map((r) => ({ value: r.id, label: r.name }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Stop</Label>
              <NativeSelect
                className="w-40"
                placeholder="Select stop"
                value={assignForm.stopId}
                onChange={(v) => setAssignForm((f) => ({ ...f, stopId: v }))}
                options={selectedRouteStops.map((s) => ({ value: s.id, label: s.name }))}
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={!assignForm.studentEnrollmentId || !assignForm.routeId || !assignForm.stopId}
            >
              Assign
            </Button>
          </form>
        </CardContent>
      </Card>

      <LiveTrackingCard />
    </div>
  );
}

// Live Tracking (Phase 7 slice 7d-2) — a Leaflet map plotting every
// vehicle's most recent known position. SWR polling, same ~20-30s
// cadence as everywhere else in this project — no websocket
// infrastructure exists here, and one isn't being introduced for this.
function LiveTrackingCard() {
  const tracking = useSWR("vehicle-tracking-latest", () => api.listLatestTrackingByVehicle(), {
    refreshInterval: 25_000,
  });

  const points = (tracking.data ?? []).map((t) => ({
    id: t.vehicleId,
    lat: Number(t.latitude),
    lng: Number(t.longitude),
    label: `${t.vehicle.registrationNumber} — ${new Date(t.recordedAt).toLocaleTimeString()}`,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Tracking</CardTitle>
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <p className="text-muted-foreground text-sm">No vehicle position updates yet.</p>
        ) : (
          <LiveTrackingMap
            center={[points[0].lat, points[0].lng]}
            markers={points}
            zoom={12}
            heightClassName="h-96"
          />
        )}
      </CardContent>
    </Card>
  );
}
