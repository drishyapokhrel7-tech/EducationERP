"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Building2, ClipboardList, GraduationCap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { StatCard } from "@/components/ui/stat-card";
import { api } from "@/lib/api";

export default function DashboardPage() {
  const { data: organization } = useSWR("organization", () => api.getOwnOrganization());
  const { data: campuses = [], mutate: mutateCampuses } = useSWR("campuses", () =>
    api.listCampuses(),
  );
  const { data: students = [] } = useSWR("students", () => api.listStudents());
  const { data: employees = [] } = useSWR("employees", () => api.listEmployees());
  const { data: applications = [] } = useSWR("admission-applications", () =>
    api.listAdmissionApplications(),
  );
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", code: "" });

  async function onCreateCampus(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const campus = await api.createCampus(form);
      setForm({ name: "", code: "" });
      toast.success("Campus created");
      mutateCampuses([...campuses, campus], { revalidate: false });
    } catch {
      toast.error("Failed to create campus");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{organization?.name ?? "Loading…"}</h1>
        <p className="text-muted-foreground text-sm">
          Phase 1 foundation — campuses below are scoped to your organization by both the API
          and Postgres row-level security.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Campuses" value={campuses.length} icon={<Building2 className="size-4" />} />
        <StatCard label="Students" value={students.length} icon={<GraduationCap className="size-4" />} />
        <StatCard label="Staff" value={employees.length} icon={<Users className="size-4" />} />
        <StatCard
          label="Admissions"
          value={applications.length}
          icon={<ClipboardList className="size-4" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campuses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {campuses.length === 0 ? (
            <p className="text-muted-foreground text-sm">No campuses yet.</p>
          ) : (
            <ul className="divide-y">
              {campuses.map((campus) => (
                <li key={campus.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{campus.name}</span>
                  <span className="text-muted-foreground">{campus.code}</span>
                </li>
              ))}
            </ul>
          )}

          <Separator />

          <form onSubmit={onCreateCampus} className="flex items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="campus-name">Name</Label>
              <Input
                id="campus-name"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campus-code">Code</Label>
              <Input
                id="campus-code"
                required
                className="w-24"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              />
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? "Adding…" : "Add campus"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
