# Per-school Roles & Permissions admin, and the audit trail

Companion to [`PHASE_0_ARCHITECTURE.md`](./PHASE_0_ARCHITECTURE.md), but
not a numbered Phase 7 slice — this is a cross-cutting Identity &
Access Management feature, sitting alongside the phase roadmap rather
than a step in it (same reasoning as
[`LIBRARY_SYSTEM_INTEGRATION_NOTES.md`](./LIBRARY_SYSTEM_INTEGRATION_NOTES.md)).

## Context

User asked for per-school data isolation ("virtual database" per
school), fine-grained role/permission management with a "master
template," and fine-grained auditing. Investigation before planning
(reading the actual schema and code, not assuming) found:

- **Tenant isolation was already fully solved** — every one of the 84
  Prisma models at the time was checked; each is scoped to one
  `Organization`, enforced twice independently (app-level
  `withTenant()` + real Postgres RLS). That already *is* the "virtual
  database per school" concept — nothing to build there.
- **The data model already anticipated per-school custom roles** —
  `Role.organizationId` is nullable (`isSystem: Boolean` distinguishes
  a global template role from an org-owned custom one), `Permission`
  is a global catalog, `RolePermission` joins them. `"user"` and
  `"role"` were *already* reserved resources in `prisma/seed.ts`'s
  `RESOURCES` list since Phase 1, with Super Admin/Organization Admin
  already granted every action on both — this feature had been
  sitting half-built since Phase 1, just missing the API/UI.
- **`AccessPolicy`** (a dormant `rules: Json` model) looks scaffolded
  for a future, more complex attribute/condition-based policy engine —
  a different, fuzzier problem than what was asked for. Left
  untouched; simple role→permission toggling is the right fit for
  "manage roles and permissions in a minute way with an existing
  template as master."
- **Audit logging existed but was thin** — the `AuditLog` table had
  never had a *read* endpoint, and only 3 files ever wrote to it (auth
  events, biometric policy, camera events).
- **Permissions are baked into the JWT at login/refresh**
  (`PermissionsGuard` checks `user.permissions` from the token, not a
  live DB query) — a role's permission change takes effect for
  already-logged-in users on their next silent token refresh (within
  the 15-minute access-token TTL by default), not instantly. Stated
  plainly as existing, working-as-designed behavior, not a bug.
- **No endpoint listed users at all** — Employee/Student are separate
  domain entities; the underlying `User` accounts were never directly
  listable. A real "assign a role to a user" UI needs one.

Confirmed via `AskUserQuestion`: (1) expand audit logging as part of
this slice, scoped to the new role/permission-management actions
themselves (not a platform-wide retrofit); (2) only Super Admin/
Organization Admin can manage roles — matches every other resource in
this platform.

## What shipped

**No new `Permission` rows needed for `role`/`user`** — already seeded
with full Super Admin/Organization Admin access from Phase 1, unused
until now. **One new resource**: `audit_log` (only `view` is wired to
an endpoint, seeded with the full 9-action matrix per this project's
own convention).

**New `rbac` module** (`services/api/src/modules/rbac/`) — folds the
audit-log *read* endpoint in here too rather than a near-empty
separate module, same reasoning already used for
`financial-transactions` folding into the `finance` module:

- `GET/POST/PATCH/DELETE .../roles` — list (system + this org's
  custom roles, permissions inlined), create, edit, delete a custom
  role. 404s (not 403) on any attempt to touch a system role or
  another org's role — same IDOR-by-construction discipline used
  everywhere else in this project. Delete 409s with the exact
  assigned-user count if the role is still in use, rather than
  silently cascading.
- `GET .../permissions` — the global Permission catalog (the "master
  template" every role is built from).
- `GET .../users` — org users (excluding `passwordHash`), each with
  their current role assignments.
- `POST/DELETE .../users/:id/roles[/:roleId]` — assign/unassign a
  role. 409 on a duplicate assignment, not a silent no-op.
- `GET .../audit-logs?resource=&action=&limit=` — this org's own audit
  trail, newest first (capped at 200 — no pagination infra exists
  anywhere in this codebase yet).

`Role`/`Permission`/`RolePermission`/`UserRole` are deliberately **not
RLS-covered** (same reason `users`/`sessions` aren't — auth's
login-by-email has to work before a tenant context exists), so every
service method does its own explicit `organizationId` check rather
than relying on `withTenant()`'s RLS GUC for these specific tables.

Every mutating action (`role.created`, `role.updated`, `role.deleted`,
`user.role_assigned`, `user.role_unassigned`) writes an `AuditLog` row
in the same transaction, exact same shape as the existing
`biometric-policy.service.ts` calls.

**Web UI**: new `/dashboard/roles-permissions` page (new nav entry),
same one-page-many-Cards structure as `/dashboard/finance`/
`/dashboard/library`. Three sections: **Roles** (system roles shown
read-only as the master template; custom roles with a full
resource × action permission-matrix checkbox grid for create/edit, a
"start from an existing role" dropdown that prefills checkboxes
client-side — no separate clone endpoint, this is purely a frontend
convenience), **Users** (list + per-user assign/unassign), **Audit
Log** (a live-refreshing read-only feed).

## A real bug found via the browser pass, not typecheck/lint/build

The Audit Log panel's `useSWR` hook was never told to re-fetch after
any of the role/permission mutations — so a real action (create a
role, assign it) worked correctly against the API, but the Audit Log
section on screen kept showing stale data until a manual page reload.
Confirmed the actual `AuditLog` rows were being written correctly the
whole time (checked via the network tab and a reload); the bug was
purely "forgot to call `auditLogs.mutate()` alongside `roles.mutate()`/
`users.mutate()` in every mutating action's success callback." Fixed
in all four call sites (create/update role, delete role, assign role,
unassign role) and re-verified live in the browser — the panel now
updates immediately without a reload.

## Explicitly not in this slice

- `AccessPolicy` / any condition-based rules engine.
- A platform-wide audit retrofit — only the new role/permission/user
  actions are audited now; the ~55 other resources' mutations remain
  unaudited until a future slice decides to do that deliberately.
- Delegating role-management to a role other than Super Admin/
  Organization Admin.
- Any change to how permissions propagate (live vs. next-token-refresh).

## Verified

- `pnpm -r typecheck` / `lint` / `build` clean.
- One comprehensive e2e test in `tenant-isolation.e2e-spec.ts`:
  creates a custom role from one permission (`invoice:view`), rejects
  a duplicate name (409), creates a second real user (via the existing
  student create-login flow, then re-points them from the auto-granted
  "Student" role onto the custom role under test via the new
  assign/unassign endpoints), confirms a user holding *only* that
  custom role can hit exactly the one permitted endpoint (200) and
  gets 403 on an unpermitted one, edits the role to revoke the
  permission and confirms an *already-issued* token still works (baked
  in at login) while a *freshly issued* one correctly 403s, confirms
  deleting a still-assigned role 409s with the correct count, confirms
  cross-tenant isolation (org B can't see, edit, or be affected by org
  A's custom roles/users even by a well-formed id), and confirms
  `AuditLog` rows exist for every one of the five mutating actions.
  Full suite re-run clean afterward (no regressions).
- Full browser pass, as the demo admin: confirmed all 17 real system
  roles render correctly with their real permission counts (531 for
  Super Admin/Organization Admin, 0 for the other 15 — matching the
  seed exactly), confirmed the real user list (including a real
  ERP-linked demo student) and the historical audit trail (real
  biometric-policy/face-enrollment entries from Phase 6, surfaced for
  the first time via this slice's new read endpoint) rendered
  correctly. Created a real custom role ("Attendance Viewer",
  `attendance:VIEW` only) through the actual permission-matrix UI,
  confirmed the created role's permission set matched exactly what was
  checked, assigned it to a real student, confirmed both the
  assignment and the live-updating audit log worked, unassigned it,
  deleted the role, and confirmed the final state and audit trail were
  exactly as expected with zero leftover test data.
