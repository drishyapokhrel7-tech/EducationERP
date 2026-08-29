"use client";

import { useMemo, useState, type FormEvent } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api";
import { submitAction, submitDelete } from "@/lib/submit-action";
import type { RoleRecord } from "@education-erp/api-client";

const ACTIONS = ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT", "PRINT", "MANAGE", "ADMINISTER"] as const;
const ACTION_LABELS: Record<(typeof ACTIONS)[number], string> = {
  VIEW: "View",
  CREATE: "Create",
  UPDATE: "Update",
  DELETE: "Delete",
  APPROVE: "Approve",
  EXPORT: "Export",
  PRINT: "Print",
  MANAGE: "Manage",
  ADMINISTER: "Administer",
};

function permissionKey(resource: string, action: string) {
  return `${resource}:${action}`;
}

function resourceLabel(resource: string) {
  return resource
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

// Grouped by the same domain areas this resource list was actually
// built in (services/api/prisma/seed.ts's own RESOURCES array, added
// phase-by-phase with a comment naming each group) — not a generic
// alphabetical list. A resource not found in any group here falls
// into "Other" below, so a newly-added resource never silently
// disappears from the matrix.
const RESOURCE_GROUPS: { label: string; resources: string[] }[] = [
  { label: "Organization", resources: ["organization", "campus", "user", "role"] },
  { label: "Org Structure", resources: ["faculty", "department", "program", "academic_year", "term", "section"] },
  {
    label: "Staff & HR",
    resources: ["staff_type", "designation", "employee", "employment_history", "qualification", "teacher_profile"],
  },
  { label: "Academics", resources: ["subject", "curriculum"] },
  { label: "Students & Admissions", resources: ["student", "guardian", "enrollment", "admission"] },
  { label: "Timetable", resources: ["room", "period", "teaching_assignment", "class_schedule"] },
  { label: "Attendance", resources: ["attendance", "staff_attendance"] },
  {
    label: "Teaching & Learning",
    resources: ["syllabus", "lesson_plan", "class_session", "assignment", "knowledge_check", "dashboard"],
  },
  {
    label: "Examinations",
    resources: [
      "exam_type",
      "grading_scheme",
      "question_bank",
      "question",
      "exam",
      "exam_subject",
      "exam_schedule",
      "exam_room",
      "exam_attempt",
      "marks",
      "grade",
      "report_card",
    ],
  },
  { label: "Biometric & Security", resources: ["biometric_policy", "biometric_enrollment", "camera", "face_match_event"] },
  {
    label: "Finance",
    resources: ["fee_category", "fee_structure", "student_fee_assignment", "invoice", "payment", "scholarship", "discount", "refund"],
  },
  { label: "Administration", resources: ["audit_log"] },
  { label: "Leave", resources: ["leave_type", "leave_request"] },
  { label: "Payroll", resources: ["salary_structure", "payroll"] },
  { label: "Transport", resources: ["vehicle", "route"] },
  { label: "Hostel", resources: ["hostel"] },
  { label: "Inventory", resources: ["inventory"] },
  { label: "Communication", resources: ["communication"] },
  { label: "Documents", resources: ["document"] },
  { label: "Alumni & Career", resources: ["alumni"] },
  { label: "Analytics", resources: ["analytics"] },
];

export default function RolesPermissionsPage() {
  const roles = useSWR("rbac-roles", () => api.listRoles());
  const permissions = useSWR("rbac-permissions", () => api.listPermissions());
  const users = useSWR("rbac-users", () => api.listOrgUsers());
  const auditLogs = useSWR("rbac-audit-logs", () => api.listAuditLogs());

  const permissionIdByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of permissions.data ?? []) map.set(permissionKey(p.resource, p.action), p.id);
    return map;
  }, [permissions.data]);

  // ── Role editor (shared by create + edit) ────────────────────────────
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState({ name: "", description: "" });
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<string>>(new Set());
  const [cloneFromId, setCloneFromId] = useState("");
  const [matrixSearch, setMatrixSearch] = useState("");
  // Deleting a role silently revokes access for everyone still holding
  // it, with no other on-screen effect — the one delete in this app
  // that most needs a confirm step before it fires.
  const [deletingRole, setDeletingRole] = useState<{ id: string; name: string } | null>(null);

  const isViewingSystemRole = editingRoleId !== null && editingRoleId !== "__new__" && (roles.data ?? []).find((r) => r.id === editingRoleId)?.isSystem === true;

  // Grouped by domain area (see RESOURCE_GROUPS), filtered by the
  // search box, and with any resource not in a named group falling
  // into "Other" — so a newly-added resource never silently vanishes
  // from the matrix instead of just being uncategorized.
  const matrixGroups = useMemo(() => {
    const allResources = new Set((permissions.data ?? []).map((p) => p.resource));
    const grouped = new Set<string>();
    const query = matrixSearch.trim().toLowerCase();
    const groups = RESOURCE_GROUPS.map((g) => {
      const resources = g.resources.filter((r) => allResources.has(r));
      resources.forEach((r) => grouped.add(r));
      return { label: g.label, resources };
    });
    const other = [...allResources].filter((r) => !grouped.has(r)).sort();
    if (other.length > 0) groups.push({ label: "Other", resources: other });
    if (!query) return groups.filter((g) => g.resources.length > 0);
    return groups
      .map((g) => ({ label: g.label, resources: g.resources.filter((r) => resourceLabel(r).toLowerCase().includes(query)) }))
      .filter((g) => g.resources.length > 0);
  }, [permissions.data, matrixSearch]);

  function startCreate() {
    setEditingRoleId("__new__");
    setRoleForm({ name: "", description: "" });
    setSelectedPermissionIds(new Set());
    setCloneFromId("");
  }

  function startEdit(role: RoleRecord) {
    setEditingRoleId(role.id);
    setRoleForm({ name: role.name, description: role.description ?? "" });
    setSelectedPermissionIds(new Set(role.rolePermissions.map((rp) => rp.permissionId)));
    setCloneFromId("");
  }

  function applyClone(roleId: string) {
    setCloneFromId(roleId);
    const source = roles.data?.find((r) => r.id === roleId);
    if (source) {
      setSelectedPermissionIds(new Set(source.rolePermissions.map((rp) => rp.permissionId)));
    }
  }

  function togglePermission(id: string) {
    setSelectedPermissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const customRoles = (roles.data ?? []).filter((r) => !r.isSystem);
  const systemRoles = (roles.data ?? []).filter((r) => r.isSystem);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Roles & Permissions</h1>
        <p className="text-muted-foreground text-sm">
          Custom roles for this school, built from the shared permission catalog. Assign roles to users, and
          review the audit trail of every change.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">System roles (master template — not editable)</p>
            <ul className="divide-y text-sm">
              {systemRoles.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {r.name} <span className="text-muted-foreground">({r.rolePermissions.length} permissions)</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">System</Badge>
                    <Button type="button" size="sm" variant="outline" onClick={() => startEdit(r)}>
                      View
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <Separator />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Custom roles for this school</p>
              <Button type="button" size="sm" onClick={startCreate}>
                New role
              </Button>
            </div>
            {customRoles.length === 0 ? (
              <p className="text-muted-foreground text-sm">No custom roles yet.</p>
            ) : (
              <ul className="divide-y text-sm">
                {customRoles.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      {r.name} <span className="text-muted-foreground">({r.rolePermissions.length} permissions)</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="info">Custom</Badge>
                      <Button type="button" size="sm" variant="outline" onClick={() => startEdit(r)}>
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeletingRole({ id: r.id, name: r.name })}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {editingRoleId ? (
            <>
              <Separator />
              <form
                className="space-y-3"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  const permissionIds = [...selectedPermissionIds];
                  const isNew = editingRoleId === "__new__";
                  submitAction(
                    () =>
                      isNew
                        ? api.createRole({ name: roleForm.name, description: roleForm.description || undefined, permissionIds })
                        : api.updateRole(editingRoleId, {
                            name: roleForm.name,
                            description: roleForm.description || undefined,
                            permissionIds,
                          }),
                    () => {
                      setEditingRoleId(null);
                      roles.mutate();
                      auditLogs.mutate();
                    },
                  );
                }}
              >
                <p className="text-sm font-medium">
                  {editingRoleId === "__new__" ? "New custom role" : isViewingSystemRole ? "Viewing system role" : "Edit role"}
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input
                      disabled={isViewingSystemRole}
                      value={roleForm.name}
                      onChange={(e) => setRoleForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Description</Label>
                    <Input
                      className="w-56"
                      disabled={isViewingSystemRole}
                      value={roleForm.description}
                      onChange={(e) => setRoleForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </div>
                  {editingRoleId === "__new__" ? (
                    <div className="space-y-1">
                      <Label className="text-xs">Start from an existing role</Label>
                      <NativeSelect
                        className="w-56"
                        placeholder="Blank"
                        value={cloneFromId}
                        onChange={applyClone}
                        options={(roles.data ?? []).map((r) => ({ value: r.id, label: r.name }))}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Search permissions</Label>
                  <Input
                    className="w-56"
                    placeholder="e.g. invoice, attendance…"
                    value={matrixSearch}
                    onChange={(e) => setMatrixSearch(e.target.value)}
                  />
                </div>

                <div className="max-h-96 space-y-3 overflow-auto rounded border p-2">
                  {matrixGroups.length === 0 ? (
                    <p className="text-muted-foreground p-2 text-xs">No permissions match &quot;{matrixSearch}&quot;.</p>
                  ) : (
                    matrixGroups.map((group) => {
                      const groupPermissionIds = group.resources.flatMap((r) =>
                        ACTIONS.map((a) => permissionIdByKey.get(permissionKey(r, a))).filter((id): id is string => Boolean(id)),
                      );
                      const selectedInGroup = groupPermissionIds.filter((id) => selectedPermissionIds.has(id)).length;
                      return (
                        <details key={group.label} open className="rounded border">
                          <summary className="bg-muted flex cursor-pointer items-center justify-between gap-2 p-2 text-xs font-medium select-none">
                            <span>
                              {group.label}{" "}
                              <span className="text-muted-foreground font-normal">
                                ({selectedInGroup}/{groupPermissionIds.length})
                              </span>
                            </span>
                            {!isViewingSystemRole ? (
                              <label className="flex items-center gap-1 font-normal" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={groupPermissionIds.length > 0 && selectedInGroup === groupPermissionIds.length}
                                  onChange={() => {
                                    const turnOn = selectedInGroup !== groupPermissionIds.length;
                                    setSelectedPermissionIds((prev) => {
                                      const next = new Set(prev);
                                      for (const id of groupPermissionIds) {
                                        if (turnOn) next.add(id);
                                        else next.delete(id);
                                      }
                                      return next;
                                    });
                                  }}
                                />
                                Select all
                              </label>
                            ) : null}
                          </summary>
                          <table className="w-full text-xs">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="p-2 text-left">Resource</th>
                                {ACTIONS.map((a) => (
                                  <th key={a} className="p-2 text-center">
                                    {ACTION_LABELS[a]}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {group.resources.map((resource) => (
                                <tr key={resource} className="border-t">
                                  <td className="p-2">{resourceLabel(resource)}</td>
                                  {ACTIONS.map((action) => {
                                    const permId = permissionIdByKey.get(permissionKey(resource, action));
                                    if (!permId) return <td key={action} className="p-2 text-center">—</td>;
                                    return (
                                      <td key={action} className="p-2 text-center">
                                        <input
                                          type="checkbox"
                                          disabled={isViewingSystemRole}
                                          checked={selectedPermissionIds.has(permId)}
                                          onChange={() => togglePermission(permId)}
                                        />
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </details>
                      );
                    })
                  )}
                </div>

                <div className="flex gap-2">
                  {!isViewingSystemRole ? (
                    <Button type="submit" size="sm" disabled={!roleForm.name}>
                      Save role
                    </Button>
                  ) : null}
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditingRoleId(null)}>
                    {isViewingSystemRole ? "Close" : "Cancel"}
                  </Button>
                </div>
              </form>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          {!users.data || users.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No users yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {users.data.map((u) => (
                <li key={u.id} className="space-y-2 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      {u.firstName} {u.lastName} <span className="text-muted-foreground">— {u.email}</span>
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {u.userRoles.map((ur) => (
                        <Badge key={ur.id} variant={ur.role.isSystem ? "secondary" : "info"}>
                          {ur.role.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <UserRoleAssign
                    userId={u.id}
                    roles={roles.data ?? []}
                    onAssigned={() => {
                      users.mutate();
                      auditLogs.mutate();
                    }}
                    onUnassigned={() => {
                      users.mutate();
                      auditLogs.mutate();
                    }}
                    assignedRoleIds={u.userRoles.map((ur) => ur.roleId)}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit Log</CardTitle>
        </CardHeader>
        <CardContent>
          {!auditLogs.data || auditLogs.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No audit entries yet.</p>
          ) : (
            <ul className="divide-y text-xs">
              {auditLogs.data.map((entry) => (
                <li key={entry.id} className="py-2">
                  <span className="font-medium">{entry.action}</span>{" "}
                  <span className="text-muted-foreground">
                    by {entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : "system"} ·{" "}
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deletingRole !== null}
        onOpenChange={(open) => !open && setDeletingRole(null)}
        title={`Delete the "${deletingRole?.name}" role?`}
        description={
          deletingRole
            ? `${(users.data ?? []).filter((u) => u.userRoles.some((ur) => ur.roleId === deletingRole.id)).length} user(s) currently hold this role — deleting it revokes whatever access it granted them immediately, with no separate warning to them.`
            : ""
        }
        confirmLabel="Delete role"
        variant="destructive"
        onConfirm={() => {
          if (!deletingRole) return;
          return submitDelete(() => api.deleteRole(deletingRole.id), () => {
            roles.mutate();
            auditLogs.mutate();
          });
        }}
      />
    </div>
  );
}

function UserRoleAssign({
  userId,
  roles,
  assignedRoleIds,
  onAssigned,
  onUnassigned,
}: {
  userId: string;
  roles: RoleRecord[];
  assignedRoleIds: string[];
  onAssigned: () => void;
  onUnassigned: () => void;
}) {
  const [roleId, setRoleId] = useState("");
  const assignable = roles.filter((r) => !assignedRoleIds.includes(r.id));

  return (
    <div className="flex flex-wrap items-end gap-2">
      <NativeSelect
        className="h-8 w-48"
        placeholder="Assign a role"
        value={roleId}
        onChange={setRoleId}
        options={assignable.map((r) => ({ value: r.id, label: r.name }))}
      />
      <Button
        type="button"
        size="sm"
        className="h-8"
        disabled={!roleId}
        onClick={() =>
          submitAction(
            () => api.assignRole(userId, { roleId }),
            () => {
              setRoleId("");
              onAssigned();
            },
          )
        }
      >
        Assign
      </Button>
      {assignedRoleIds.map((rid) => {
        const role = roles.find((r) => r.id === rid);
        if (!role) return null;
        return (
          <Button
            key={rid}
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() =>
              submitAction(
                () => api.unassignRole(userId, rid),
                () => onUnassigned(),
              )
            }
          >
            Remove {role.name}
          </Button>
        );
      })}
    </div>
  );
}
