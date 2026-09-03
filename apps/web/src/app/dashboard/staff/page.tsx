"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { EntityCard } from "@/components/dashboard/entity-card";
import { ListPager } from "@/components/dashboard/list-pager";
import { PhotoInput, EMPTY_PHOTO, hasPhoto, resolvePhotoUrl, type PhotoValue } from "@/components/photo-input";
import { Avatar } from "@/components/avatar";
import { EditionUsageBadge } from "@/components/edition-usage-badge";
import { EditionUpgradeBanner } from "@/components/edition-upgrade-banner";
import { api } from "@/lib/api";
import { useHighlightFromSearch } from "@/lib/use-highlight-from-search";
import { isEditionLimitError } from "@/lib/edition-limit-error";
import { useEditionStatus } from "@/lib/use-edition-status";
import { submitAction, submitDelete, errorMessage } from "@/lib/submit-action";
import { ApiError, type Edition } from "@education-erp/api-client";

export default function StaffPage() {
  // Same SWR key dashboard/page.tsx already fetches this under, so
  // this dedupes against that request instead of firing a second one
  // — used to compute a portal login's username, which is
  // deterministic (see handleCreateLogin's own comment below).
  const organization = useSWR("organization", () => api.getOwnOrganization());
  const staffTypes = useSWR("staff-types", () => api.listStaffTypes());
  const designations = useSWR("designations", () => api.listDesignations());
  const departments = useSWR("departments", () => api.listDepartments());
  // Paginated (Phase 8 performance-optimization slice) — employeesPage
  // is part of the SWR key so changing it triggers a fresh fetch of
  // that page, same pattern as the students admin list.
  const [employeesPage, setEmployeesPage] = useState(1);
  const employees = useSWR(["employees", employeesPage], () => api.listEmployees({ page: employeesPage }));
  const editionStatus = useEditionStatus();
  const [editionLimitEdition, setEditionLimitEdition] = useState<Edition | null>(null);
  useHighlightFromSearch(Boolean(employees.data));

  // Keyed by employeeId, same per-row pattern as the students page's
  // create-login form.
  const [loginPasswordForms, setLoginPasswordForms] = useState<Record<string, string>>({});

  // The backend derives the username as `${orgSlug}.${employeeCode}`
  // (StaffService.createLogin) — deterministic from data already on
  // the record, so it's computed here rather than only shown once from
  // the create-login response and then lost forever on refresh.
  function employeeUsername(employeeCode: string): string {
    return organization.data ? `${organization.data.slug}.${employeeCode}` : employeeCode;
  }

  async function handleCreateLogin(employeeId: string) {
    const password = loginPasswordForms[employeeId] ?? "";
    try {
      await api.createEmployeeLogin(employeeId, { password });
      setLoginPasswordForms((f) => ({ ...f, [employeeId]: "" }));
      employees.mutate();
      toast.success("Login created");
    } catch {
      toast.error("Failed to create login — password must be at least 8 characters");
    }
  }

  const [staffTypeForm, setStaffTypeForm] = useState({ name: "", code: "" });
  const [designationForm, setDesignationForm] = useState({ name: "", code: "" });

  // Edit state, one per catalog entity on this page — a separate,
  // small inline form (rendered via EntityCard's `footer`) rather
  // than merging into the always-visible create form above, since
  // these entities are tiny (name+code) and the create form stays
  // unconditional either way.
  const [editingStaffTypeId, setEditingStaffTypeId] = useState<string | null>(null);
  const [editStaffTypeForm, setEditStaffTypeForm] = useState({ name: "", code: "" });
  const [editingDesignationId, setEditingDesignationId] = useState<string | null>(null);
  const [editDesignationForm, setEditDesignationForm] = useState({ name: "", code: "" });
  const [employeeForm, setEmployeeForm] = useState({
    staffTypeId: "",
    designationId: "",
    departmentId: "",
    employeeCode: "",
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfJoining: "",
  });
  const [employeePhoto, setEmployeePhoto] = useState<PhotoValue>(EMPTY_PHOTO);

  // employeeCode is deliberately excluded — see UpdateEmployeeDto's own
  // comment (it's fixed once a portal login exists).
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [editEmployeeForm, setEditEmployeeForm] = useState({
    staffTypeId: "",
    designationId: "",
    departmentId: "",
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfJoining: "",
  });
  const [editEmployeePhoto, setEditEmployeePhoto] = useState<PhotoValue>(EMPTY_PHOTO);

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
      toast.error(errorMessage(err, "Failed to create — check that required fields are filled in"));
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
        id="staff-types"
        title="Staff types"
        emptyLabel="No staff types yet."
        items={staffTypes.data}
        renderItem={(t: { id: string; name: string; code: string }) => (
          <div className="flex items-center justify-between gap-2">
            <span>
              {t.name} <span className="text-muted-foreground">{t.code}</span>
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingStaffTypeId(t.id);
                  setEditStaffTypeForm({ name: t.name, code: t.code });
                }}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => submitDelete(() => api.deleteStaffType(t.id), () => staffTypes.mutate())}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
        footer={
          editingStaffTypeId ? (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                submitAction(
                  () => api.updateStaffType(editingStaffTypeId, editStaffTypeForm),
                  () => {
                    setEditingStaffTypeId(null);
                    staffTypes.mutate();
                  },
                );
              }}
            >
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  required
                  value={editStaffTypeForm.name}
                  onChange={(e) => setEditStaffTypeForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  required
                  className="w-24"
                  value={editStaffTypeForm.code}
                  onChange={(e) => setEditStaffTypeForm((f) => ({ ...f, code: e.target.value }))}
                />
              </div>
              <Button type="submit" size="sm">
                Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingStaffTypeId(null)}>
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
        id="designations"
        title="Designations"
        emptyLabel="No designations yet."
        items={designations.data}
        renderItem={(d: { id: string; name: string; code: string }) => (
          <div className="flex items-center justify-between gap-2">
            <span>
              {d.name} <span className="text-muted-foreground">{d.code}</span>
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingDesignationId(d.id);
                  setEditDesignationForm({ name: d.name, code: d.code });
                }}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => submitDelete(() => api.deleteDesignation(d.id), () => designations.mutate())}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
        footer={
          editingDesignationId ? (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                submitAction(
                  () => api.updateDesignation(editingDesignationId, editDesignationForm),
                  () => {
                    setEditingDesignationId(null);
                    designations.mutate();
                  },
                );
              }}
            >
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  required
                  value={editDesignationForm.name}
                  onChange={(e) => setEditDesignationForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  required
                  className="w-24"
                  value={editDesignationForm.code}
                  onChange={(e) => setEditDesignationForm((f) => ({ ...f, code: e.target.value }))}
                />
              </div>
              <Button type="submit" size="sm">
                Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingDesignationId(null)}>
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
        id="employees"
        title="Employees"
        titleExtra={<EditionUsageBadge status={editionStatus.data} />}
        emptyLabel="No employees yet."
        items={employees.data?.data}
        footer={
          <>
            {editingEmployeeId ? (
              <form
                className="flex flex-wrap items-end gap-3 border-b pb-4"
                onSubmit={(ev: FormEvent) => {
                  ev.preventDefault();
                  submitAction(
                    async () => {
                      const photoUrl = hasPhoto(editEmployeePhoto) ? await resolvePhotoUrl(editEmployeePhoto) : undefined;
                      return api.updateEmployee(editingEmployeeId, {
                        ...editEmployeeForm,
                        departmentId: editEmployeeForm.departmentId || undefined,
                        middleName: editEmployeeForm.middleName || undefined,
                        phone: editEmployeeForm.phone || undefined,
                        photoUrl,
                      });
                    },
                    () => {
                      setEditingEmployeeId(null);
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
                    value={editEmployeeForm.staffTypeId}
                    onChange={(v) => setEditEmployeeForm((f) => ({ ...f, staffTypeId: v }))}
                    options={(staffTypes.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Designation</Label>
                  <NativeSelect
                    className="w-36"
                    placeholder="Select designation"
                    value={editEmployeeForm.designationId}
                    onChange={(v) => setEditEmployeeForm((f) => ({ ...f, designationId: v }))}
                    options={(designations.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Department (optional)</Label>
                  <NativeSelect
                    className="w-36"
                    placeholder="None"
                    value={editEmployeeForm.departmentId}
                    onChange={(v) => setEditEmployeeForm((f) => ({ ...f, departmentId: v }))}
                    options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>First name</Label>
                  <Input
                    required
                    value={editEmployeeForm.firstName}
                    onChange={(e) => setEditEmployeeForm((f) => ({ ...f, firstName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Middle name (optional)</Label>
                  <Input
                    value={editEmployeeForm.middleName}
                    onChange={(e) => setEditEmployeeForm((f) => ({ ...f, middleName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last name</Label>
                  <Input
                    required
                    value={editEmployeeForm.lastName}
                    onChange={(e) => setEditEmployeeForm((f) => ({ ...f, lastName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    required
                    type="email"
                    value={editEmployeeForm.email}
                    onChange={(e) => setEditEmployeeForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone (optional)</Label>
                  <Input
                    value={editEmployeeForm.phone}
                    onChange={(e) => setEditEmployeeForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date of joining</Label>
                  <Input
                    required
                    type="date"
                    value={editEmployeeForm.dateOfJoining}
                    onChange={(e) => setEditEmployeeForm((f) => ({ ...f, dateOfJoining: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Photo</Label>
                  <PhotoInput value={editEmployeePhoto} onChange={setEditEmployeePhoto} />
                </div>
                <Button type="submit" size="sm" disabled={!hasPhoto(editEmployeePhoto)}>
                  Save
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setEditingEmployeeId(null)}>
                  Cancel
                </Button>
              </form>
            ) : null}
            {employees.data ? (
              <ListPager
                page={employees.data.page}
                totalPages={employees.data.totalPages}
                onPrev={() => setEmployeesPage((p) => Math.max(1, p - 1))}
                onNext={() => setEmployeesPage((p) => p + 1)}
              />
            ) : null}
          </>
        }
        renderItem={(e: {
          id: string;
          firstName: string;
          middleName: string | null;
          lastName: string;
          employeeCode: string;
          userId: string | null;
          photoUrl: string | null;
          staffTypeId: string;
          designationId: string;
          departmentId: string | null;
          email: string;
          phone: string | null;
          dateOfJoining: string;
          designation?: { name: string };
        }) => (
          <div id={`employee-${e.id}`} className="rounded-md transition-shadow">
            <span className="flex items-center gap-2">
              <Avatar src={e.photoUrl} />
              {e.firstName} {e.middleName ? `${e.middleName} ` : ""}
              {e.lastName} <span className="text-muted-foreground">
                {e.employeeCode}
                {e.designation ? ` · ${e.designation.name}` : ""}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingEmployeeId(e.id);
                  setEditEmployeeForm({
                    staffTypeId: e.staffTypeId,
                    designationId: e.designationId,
                    departmentId: e.departmentId ?? "",
                    firstName: e.firstName,
                    middleName: e.middleName ?? "",
                    lastName: e.lastName,
                    email: e.email,
                    phone: e.phone ?? "",
                    dateOfJoining: e.dateOfJoining.slice(0, 10),
                  });
                  setEditEmployeePhoto(e.photoUrl ? { status: "uploaded", url: e.photoUrl } : EMPTY_PHOTO);
                }}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => submitDelete(() => api.deleteEmployee(e.id), () => employees.mutate())}
              >
                Delete
              </Button>
            </span>
            {e.userId ? (
              <p className="text-muted-foreground mt-1 text-xs">
                Portal login: {employeeUsername(e.employeeCode)}
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
            if (!hasPhoto(employeePhoto)) return;
            submit(
              // A captured-but-not-yet-uploaded photo is uploaded right
              // here, as part of this same Add click.
              async () => {
                const photoUrl = await resolvePhotoUrl(employeePhoto);
                return api.createEmployee({
                  ...employeeForm,
                  departmentId: employeeForm.departmentId || undefined,
                  middleName: employeeForm.middleName || undefined,
                  phone: employeeForm.phone || undefined,
                  photoUrl,
                });
              },
              () => {
                setEmployeeForm({
                  staffTypeId: "",
                  designationId: "",
                  departmentId: "",
                  employeeCode: "",
                  firstName: "",
                  middleName: "",
                  lastName: "",
                  email: "",
                  phone: "",
                  dateOfJoining: "",
                });
                setEmployeePhoto(EMPTY_PHOTO);
                setEditionLimitEdition(null);
                employees.mutate();
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label>Staff type (required)</Label>
            <NativeSelect
              className="w-36"
              placeholder="Select type"
              value={employeeForm.staffTypeId}
              onChange={(v) => setEmployeeForm((f) => ({ ...f, staffTypeId: v }))}
              options={(staffTypes.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Designation (required)</Label>
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
            <Label>Middle name (optional)</Label>
            <Input
              value={employeeForm.middleName}
              onChange={(e) => setEmployeeForm((f) => ({ ...f, middleName: e.target.value }))}
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
            <Label>Photo (required)</Label>
            <PhotoInput value={employeePhoto} onChange={setEmployeePhoto} />
          </div>
          <div className="flex flex-col items-start gap-1">
            <Button
              type="submit"
              disabled={!employeeForm.staffTypeId || !employeeForm.designationId || !hasPhoto(employeePhoto)}
            >
              Add
            </Button>
            {!employeeForm.staffTypeId || !employeeForm.designationId || !hasPhoto(employeePhoto) ? (
              <p className="text-muted-foreground text-xs">
                Needs{" "}
                {[
                  !employeeForm.staffTypeId ? "staff type" : null,
                  !employeeForm.designationId ? "designation" : null,
                  !hasPhoto(employeePhoto) ? "a photo" : null,
                ]
                  .filter(Boolean)
                  .join(", ")}{" "}
                before this can be added.
              </p>
            ) : null}
          </div>
        </form>
        {editionLimitEdition ? <EditionUpgradeBanner edition={editionLimitEdition} /> : null}
      </EntityCard>
    </div>
  );
}
