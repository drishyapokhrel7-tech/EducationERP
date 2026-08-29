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

function permissionKey(resource: string, action: string) {
  return `${resource}:${action}`;
}

export default function RolesPermissionsPage() {
  const roles = useSWR("rbac-roles", () => api.listRoles());
  const permissions = useSWR("rbac-permissions", () => api.listPermissions());
  const users = useSWR("rbac-users", () => api.listOrgUsers());
  const auditLogs = useSWR("rbac-audit-logs", () => api.listAuditLogs());

  const resources = useMemo(() => {
    const set = new Set((permissions.data ?? []).map((p) => p.resource));
    return [...set].sort();
  }, [permissions.data]);
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
  // Deleting a role silently revokes access for everyone still holding
  // it, with no other on-screen effect — the one delete in this app
  // that most needs a confirm step before it fires.
  const [deletingRole, setDeletingRole] = useState<{ id: string; name: string } | null>(null);

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
                    <Button type="button" size="sm" variant="outline" onClick={() => startEdit(r)} disabled>
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
                <p className="text-sm font-medium">{editingRoleId === "__new__" ? "New custom role" : "Edit role"}</p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input value={roleForm.name} onChange={(e) => setRoleForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Description</Label>
                    <Input
                      className="w-56"
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

                <div className="max-h-96 overflow-auto rounded border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="p-2 text-left">Resource</th>
                        {ACTIONS.map((a) => (
                          <th key={a} className="p-2 text-center">
                            {a.slice(0, 3)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resources.map((resource) => (
                        <tr key={resource} className="border-t">
                          <td className="p-2">{resource}</td>
                          {ACTIONS.map((action) => {
                            const permId = permissionIdByKey.get(permissionKey(resource, action));
                            if (!permId) return <td key={action} className="p-2 text-center">—</td>;
                            return (
                              <td key={action} className="p-2 text-center">
                                <input
                                  type="checkbox"
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
                </div>

                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={!roleForm.name}>
                    Save role
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditingRoleId(null)}>
                    Cancel
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
