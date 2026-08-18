# Phase 1 — Foundation: what shipped and why

Companion to [`PHASE_0_ARCHITECTURE.md`](./PHASE_0_ARCHITECTURE.md). Follows
the plan's own execution protocol (§21): implemented, tested, documented,
then stops for the next phase go-ahead — no Student/Academic features are
in scope here.

## What's running

- **Database**: Neon-hosted PostgreSQL 18.4 (`neondb`), pgvector 0.8.6
  enabled (not yet used — that's Phase 5).
- **Two Postgres roles, deliberately**:
  - `neondb_owner` — used only by `prisma migrate`/`prisma db seed`. It has
    `BYPASSRLS`, so it must never be the connection the running API uses.
  - `app_runtime` — no `BYPASSRLS`, no superuser. This is what
    `PrismaService` connects as (`RUNTIME_DATABASE_URL`), so the RLS
    policies below are real enforcement, not decoration. Created via SQL
    (`CREATE ROLE ... NOBYPASSRLS` + table grants); see git history for the
    exact statements run against the Neon DB.
- **Redis**: local, for BullMQ. `infra/docker-compose.yml` is the intended
  path; on this machine Docker's image pull stalled, so a Homebrew
  `redis-server` (no config file — the system's default
  `/opt/homebrew/etc/redis.conf` references a module path that doesn't
  exist and crash-loops) is standing in for local dev. Switch to
  `docker compose -f infra/docker-compose.yml up -d` once Docker's network
  path is healthy again; nothing in the app cares which one is running.
- **API**: NestJS on `:4000`. **Web**: Next.js on `:3000`.

## Schema (Phase 1 slice of plan §6)

Only `organizations` + `campuses` (Organization group) and the full
`Security` group (`users`, `roles`, `permissions`, `role_permissions`,
`user_roles`, `sessions`, `login_events`, `audit_logs`, `access_policies`)
are modeled. Everything else in plan §6 (Student, Staff, Academic,
Teaching & Learning, Attendance, Examination, Finance, ...) starts in
Phase 2+.

Seeded: all 17 roles from plan §7. Only **Super Admin** and
**Organization Admin** have permissions wired up (36 permissions across 4
resources: `organization`, `campus`, `user`, `role` × the 9 actions in
plan §7). The other 15 roles exist as named rows with no permissions yet
— there's nothing for them to have permissions *over* until later phases
add the resources they'd actually manage (a Librarian role is pointless
before there's a `books` table).

## Row-Level Security: what it does and doesn't cover

`campuses`, `audit_logs`, `access_policies` have `FORCE ROW LEVEL
SECURITY` policies keyed on a `app.current_organization_id` session GUC,
set by `PrismaService.withTenant()`. This was verified two ways:

1. A direct-SQL check as `app_runtime` (not through the app): a
   cross-tenant `SELECT ... WHERE id = <other org's row>` returns zero
   rows, and a cross-tenant `INSERT` raises a row-level-security-policy
   violation.
2. `test/tenant-isolation.e2e-spec.ts` reproduces the same checks through
   the real HTTP API end-to-end, plus a version that goes around
   `OrganizationsService`'s own `WHERE organizationId = ...` clause
   entirely (calling `withTenant` directly with no filter) to prove the
   database — not just the service code — is what's actually blocking it.

**`users`, `roles`, `sessions`, `login_events` are deliberately NOT under
RLS.** Login is a lookup by email with no tenant context yet — that's not
a gap in the RLS coverage, it's a different problem (how do you scope a
query for a request that doesn't have a tenant to scope to?) that a later
phase should solve properly (e.g. a `SECURITY DEFINER` function, or a
narrower-purpose auth-only connection role), not paper over by disabling
enforcement quietly.

## Auth

Argon2 password hashing. Access tokens are short-lived JWTs (15 min
default, `JWT_ACCESS_TTL_SECONDS`) carrying `roles`/`permissions` as
claims — this means a permission change doesn't take effect until the
user's next token refresh, a real tradeoff (simplicity now vs.
instant-revocation later) worth revisiting once permission changes are a
frequent admin action rather than a one-time bootstrap. Refresh tokens are
opaque random strings, stored only as a SHA-256 hash in `sessions`,
rotated on every use (old session revoked, new one issued).

`PermissionsGuard` checks `resource:action` strings from the JWT against
`@RequirePermissions(...)` on each route — server-side only; the web app
never uses roles/permissions to decide what's "allowed", only what to
show.

**Bug the e2e suite caught before this ever reached the UI**: the
`PermissionAction` enum is uppercase (`CREATE`, `VIEW`, ...) but
`@RequirePermissions()` decorators use lowercase (`campus:create`) — the
casing mismatch meant `loadRolesAndPermissions()` emitted `campus:CREATE`
in the JWT, so `PermissionsGuard` denied *everyone*, including
Organization Admin with all 36 permissions seeded. The first e2e run
caught this as a 403 where 201 was expected. Fixed by lowercasing the
action in `loadRolesAndPermissions()` (see `auth.service.ts`) rather than
uppercasing every decorator — decorators reading as lowercase
`resource:action` is the more conventional shape to keep as call sites
multiply in later phases.

## Web app

Next.js 16 + Tailwind v4 + shadcn/ui. Three routes: `/register`
(creates an organization + its first Organization Admin), `/login`, and
`/dashboard` (org name + campus list/create — enough to exercise the
whole stack: auth → RBAC → tenant scoping → RLS → UI). Session storage is
`localStorage`, called out in `src/lib/auth-storage.ts` as a Phase-1
shortcut: it's XSS-readable, and should move behind an httpOnly-cookie
session (e.g. a Next.js route-handler BFF in front of `services/api`)
before this app is handling real student/staff/guardian data.

## Queue

`GET /queue/health/ping` enqueues a job, `GET /queue/health/:jobId` reads
its result back — proves the Redis/BullMQ wiring end to end. Not a real
feature; later phases add actual job types (AI/document/CCTV processing
per plan §2).

## Verified

- `pnpm typecheck` / `pnpm lint` / `pnpm build` clean across `services/api`,
  `apps/web`, `packages/api-client`.
- `services/api` unit tests (auth service: login success, wrong password,
  inactive account, unknown email — all recorded to `login_events`
  regardless of outcome).
- `services/api` e2e tests: unauthenticated/garbage-token rejection,
  per-org isolation on `/organizations/me`, campus create/list scoping,
  and the RLS-backstop test described above.
- `curl` smoke test against a live `pnpm run dev` API: register-organization
  → get-own-organization → create-campus → queue ping/status round trip.
- Manual pass through the web UI in-browser: register → dashboard renders
  org name + empty campus list → add campus → logout → log back in →
  dashboard still shows the campus (confirms it's read from the API, not
  cached client state).

## Open items carried forward from Phase 0 §12

Still open: monorepo tooling is now decided (pnpm + Turborepo, as
proposed). Tenant isolation mechanism is now decided and *implemented*
(RLS + app-level scoping via a non-BYPASSRLS role) — remove from the open
list. Still open: HF model shortlist, Nepali localization depth, object
storage backend, Electron signing/update infra, deployment target, seed
data timing, and — new from this phase — the users/roles/sessions RLS
question above, and JWT-claim permission staleness.

## Next step

Per plan §21 step 17: stop here. Phase 2 (Student & Academic Core) starts
when told to proceed.
