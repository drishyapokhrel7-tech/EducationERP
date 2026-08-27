"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { EntityCard } from "@/components/dashboard/entity-card";
import { PhotoInput } from "@/components/photo-input";
import { EditionUsageBadge } from "@/components/edition-usage-badge";
import { EditionUpgradeBanner } from "@/components/edition-upgrade-banner";
import { api } from "@/lib/api";
import { useHighlightFromSearch } from "@/lib/use-highlight-from-search";
import { isEditionLimitError } from "@/lib/edition-limit-error";
import { ApiError, type Edition } from "@education-erp/api-client";

export default function StaffPage() {
  const staffTypes = useSWR("staff-types", () => api.listStaffTypes());
  const designations = useSWR("designations", () => api.listDesignations());
  const departments = useSWR("departments", () => api.listDepartments());
  const employees = useSWR("employees", () => api.listEmployees());
  const editionStatus = useSWR("edition-status", () => api.getEditionStatus());
  const [editionLimitEdition, setEditionLimitEdition] = useState<Edition | null>(null);
  useHighlightFromSearch(Boolean(employees.data));

  // Keyed by employeeId, same per-row pattern as the students page's
  // create-login form.
  const [loginPasswordForms, setLoginPasswordForms] = useState<Record<string, string>>({});
  const [createdUsernames, setCreatedUsernames] = useState<Record<string, string>>({});

  async function handleCreateLogin(employeeId: string) {
    const password = loginPasswordForms[employeeId] ?? "";
    try {
      const result = await api.createEmployeeLogin(employeeId, { password });
      setCreatedUsernames((m) => ({ ...m, [employeeId]: result.username }));
      setLoginPasswordForms((f) => ({ ...f, [employeeId]: "" }));
      employees.mutate();
      toast.success("Login created");
    } catch {
      toast.error("Failed to create login — password must be at least 8 characters");
    }
  }

  const [staffTypeForm, setStaffTypeForm] = useState({ name: "", code: "" });
  const [designationForm, setDesignationForm] = useState({ name: "", code: "" });
  const [employeeForm, setEmployeeForm] = useState({
    staffTypeId: "",
    designationId: "",
    departmentId: "",
    employeeCode: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfJoining: "",
  });
  const [employeePhotoUrl, setEmployeePhotoUrl] = useState<string | null>(null);

  async function submit(action: () => Promise<unknown>, onSuccess: () => void) {
    try {
      await action();
      onSuccess();
      toast.success("Created");
      editionStatus.mutate();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && isEditionLimitError(err.body)) {
        setEditionLimitEdition(err.body.edition);
        return;
      }
      toast.error("Failed to create — check that required fields are filled in");
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Staff</h1>
        <p className="text-muted-foreground text-sm">
          Staff types and designations classify employees; department assignment is optional.
        </p>
      </div>

      <EntityCard
        title="Staff types"
        emptyLabel="No staff types yet."
        items={staffTypes.data}
        renderItem={(t: { name: string; code: string }) => (
          <span>
            {t.name} <span className="text-muted-foreground">{t.code}</span>
          </span>
        )}
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(
              () => api.createStaffType(staffTypeForm),
              () => {
                setStaffTypeForm({ name: "", code: "" });
                staffTypes.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              required
              placeholder="Teaching"
              value={staffTypeForm.name}
              onChange={(e) => setStaffTypeForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Code</Label>
            <Input
              required
              className="w-24"
              value={staffTypeForm.code}
              onChange={(e) => setStaffTypeForm((f) => ({ ...f, code: e.target.value }))}
            />
          </div>
          <Button type="submit">Add</Button>
        </form>
      </EntityCard>

      <EntityCard
        title="Designations"
        emptyLabel="No designations yet."
        items={designations.data}
        renderItem={(d: { name: string; code: string }) => (
          <span>
            {d.name} <span className="text-muted-foreground">{d.code}</span>
          </span>
        )}
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(
              () => api.createDesignation(designationForm),
              () => {
                setDesignationForm({ name: "", code: "" });
                designations.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              required
              placeholder="Senior Teacher"
              value={designationForm.name}
              onChange={(e) => setDesignationForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Code</Label>
            <Input
              required
              className="w-24"
              value={designationForm.code}
              onChange={(e) => setDesignationForm((f) => ({ ...f, code: e.target.value }))}
            />
          </div>
          <Button type="submit">Add</Button>
        </form>
      </EntityCard>

      <EntityCard
        title="Employees"
        titleExtra={<EditionUsageBadge status={editionStatus.data} />}
        emptyLabel="No employees yet."
        items={employees.data}
        renderItem={(e: {
          id: string;
          firstName: string;
          lastName: string;
          employeeCode: string;
          userId: string | null;
          photoUrl: string | null;
          designation?: { name: string };
        }) => (
          <div id={`employee-${e.id}`} className="rounded-md transition-shadow">
            <span className="flex items-center gap-2">
              {e.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- external/storage-backend URL
                <img src={e.photoUrl} alt="" className="bg-muted size-6 rounded-full border object-cover" />
              ) : null}
              {e.firstName} {e.lastName}{" "}
              <span className="text-muted-foreground">
                {e.employeeCode}
                {e.designation ? ` · ${e.designation.name}` : ""}
              </span>
            </span>
            {e.userId ? (
              <p className="text-muted-foreground mt-1 text-xs">
                Portal login: {createdUsernames[e.id] ?? "created"}
              </p>
            ) : (
              <form
                className="mt-2 flex items-end gap-2"
                onSubmit={(ev: FormEvent) => {
                  ev.preventDefault();
                  handleCreateLogin(e.id);
                }}
              >
                <Input
                  type="password"
                  className="h-7 w-40"
                  placeholder="Set initial password"
                  value={loginPasswordForms[e.id] ?? ""}
                  onChange={(ev) => setLoginPasswordForms((f) => ({ ...f, [e.id]: ev.target.value }))}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  className="h-7"
                  disabled={(loginPasswordForms[e.id] ?? "").length < 8}
                >
                  Create login
                </Button>
              </form>
            )}
          </div>
        )}
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(ev: FormEvent) => {
            ev.preventDefault();
            submit(
              () =>
                api.createEmployee({
                  ...employeeForm,
                  departmentId: employeeForm.departmentId || undefined,
                  phone: employeeForm.phone || undefined,
                  photoUrl: employeePhotoUrl ?? undefined,
                }),
              () => {
                setEmployeeForm({
                  staffTypeId: "",
                  designationId: "",
                  departmentId: "",
                  employeeCode: "",
                  firstName: "",
                  lastName: "",
                  email: "",
                  phone: "",
                  dateOfJoining: "",
                });
                setEmployeePhotoUrl(null);
                setEditionLimitEdition(null);
                employees.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Staff type</Label>
            <NativeSelect
              className="w-36"
              placeholder="Select type"
              value={employeeForm.staffTypeId}
              onChange={(v) => setEmployeeForm((f) => ({ ...f, staffTypeId: v }))}
              options={(staffTypes.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Designation</Label>
            <NativeSelect
              className="w-36"
              placeholder="Select designation"
              value={employeeForm.designationId}
              onChange={(v) => setEmployeeForm((f) => ({ ...f, designationId: v }))}
              options={(designations.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Department (optional)</Label>
            <NativeSelect
              className="w-36"
              placeholder="None"
              value={employeeForm.departmentId}
              onChange={(v) => setEmployeeForm((f) => ({ ...f, departmentId: v }))}
              options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Employee code</Label>
            <Input
              required
              className="w-28"
              value={employeeForm.employeeCode}
              onChange={(e) => setEmployeeForm((f) => ({ ...f, employeeCode: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>First name</Label>
            <Input
              required
              value={employeeForm.firstName}
              onChange={(e) => setEmployeeForm((f) => ({ ...f, firstName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Last name</Label>
            <Input
              required
              value={employeeForm.lastName}
              onChange={(e) => setEmployeeForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              required
              type="email"
              value={employeeForm.email}
              onChange={(e) => setEmployeeForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Phone (optional)</Label>
            <Input
              value={employeeForm.phone}
              onChange={(e) => setEmployeeForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Date of joining</Label>
            <Input
              required
              type="date"
              value={employeeForm.dateOfJoining}
              onChange={(e) => setEmployeeForm((f) => ({ ...f, dateOfJoining: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Photo (optional)</Label>
            <PhotoInput value={employeePhotoUrl} onChange={setEmployeePhotoUrl} />
          </div>
          <Button type="submit" disabled={!employeeForm.staffTypeId || !employeeForm.designationId}>
            Add
          </Button>
        </form>
        {editionLimitEdition ? <EditionUpgradeBanner edition={editionLimitEdition} /> : null}
      </EntityCard>
    </div>
  );
}
