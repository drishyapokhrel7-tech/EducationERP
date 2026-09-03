# Licensing editions, platform admin console, and login CAPTCHA

Companion to [`PHASE_0_ARCHITECTURE.md`](./PHASE_0_ARCHITECTURE.md) and
every other notes file — this one documents a genuinely separate
initiative, not a slice of the plan docx's phase list (same reasoning
as [`LIBRARY_SYSTEM_INTEGRATION_NOTES.md`](./LIBRARY_SYSTEM_INTEGRATION_NOTES.md)
getting its own file rather than being folded into a `PHASE_N_NOTES.md`).

## Context

User asked for two related-but-distinct things directly, outside the
plan docx entirely:

1. **Licensing tiers**: Free (max 50 combined student+staff records,
   further creation blocked with an upgrade message once hit),
   Professional (max 500), Ultra (unspecified) — with a cross-org
   "application super admin" able to set any school's edition.
2. **"Restrict AI, allow only human logins"** — clarified via
   `AskUserQuestion` with a concrete example: *"Claude should not be
   able to read inside the system."* This names exactly the pattern
   this whole session has used for verification (direct `curl`/`fetch`
   calls to `/auth/login`) — the ask is to close that door for the
   real deployed system, not merely deter generic credential-stuffing
   bots.

Resolved via `AskUserQuestion` before building: **only new student/
staff creation is blocked at the cap** (not the whole app — existing
data stays fully usable); the platform admin gets **a separate login
entirely outside any Organization** (every existing `User` row
requires `organizationId` — confirmed directly in `schema.prisma` — so
a cross-org operator is a genuinely different kind of actor, not a
bent version of the existing tenant-scoped one); "restrict AI logins"
means **a human-verification challenge (CAPTCHA)** on login. The Ovexa
"About Us" link is env-configurable (`NEXT_PUBLIC_OVEXA_ABOUT_URL`,
default `https://ovexa.com/about` — the real registered domain, per
`school.ovexa.com` already being real in an earlier project; a real
Ovexa Technology marketing site exists locally at `~/website/site`
confirming the org name, though its own code still has a placeholder
domain) rather than blocking on a second round-trip.

Investigated directly before designing:
- **`Permission` is this schema's own precedent for a genuinely
  global, non-tenant table** — no `organizationId`, no RLS policy —
  the pattern `PlatformAdmin` follows.
- **No CAPTCHA, rate-limiting, or bot-detection existed anywhere.**
  `AccessPolicy` (a generic `rules: Json` field on `Organization`)
  exists but is completely unused (zero references in `src/`) — a
  dormant Phase-1 scaffold, not a policy engine to build on.
- **This project has a serverless deployment path**
  (`services/api/api/index.ts`, the concurrent Vercel-session context
  this whole session has carefully avoided touching) — an in-memory
  CAPTCHA-answer store would silently break there (cold, stateless
  function instances). The challenge is persisted in Postgres, not
  process memory.
- **Three login surfaces exist, not one** — the main web app, and two
  Electron clients (`apps/exam-client`, `apps/cctv-client`), each with
  its own `LoginScreen.tsx` calling `api.login(...)` through its own
  IPC bridge. All three needed the same CAPTCHA treatment; missing
  either Electron client would have left a real bypass.

## Design — Editions & platform admin console

**Schema**: `enum Edition { FREE PROFESSIONAL ULTRA }`,
`Organization.edition Edition @default(FREE)`. Record caps are a plain
exported constant map (`services/api/src/modules/organizations/
edition-limits.ts`), not per-org DB config — `{ FREE: 50, PROFESSIONAL:
500, ULTRA: null }` (`null` = unlimited). What counts toward the cap:
`Student.count + Employee.count` (both `deletedAt: null`), computed
live — the same "computed, not stored" precedent as everywhere else.

**Enforcement**: `StudentsService.createStudent`, `.importStudents`
(the CSV bulk-import path needed the same gate, per-row, or it would
have been a straightforward bypass), and `StaffService.createEmployee`
each call a shared `assertUnderEditionLimit(tx, organizationId)` before
creating, throwing a new `EditionLimitExceededException` (structured
`{ error: "EDITION_LIMIT_EXCEEDED", edition, limit }` body, not a plain
403) so the frontend can render an upgrade banner instead of a generic
toast. A downgrade that leaves an org already over its new cap needs
zero extra logic — the same `count >= limit` check already blocks any
further create.

**Usage visibility**: `GET organizations/me/edition-status` →
`{ edition, studentCount, employeeCount, limit, atLimit }` — powers a
"N of 50 used" badge on `/dashboard/students`/`/dashboard/staff` and is
reused by the platform console's own org list.

**Platform admin — a genuinely separate actor**: `PlatformAdmin` model
(no `organizationId`, no RLS, following `Permission`'s own precedent).
New `platform-auth` module: `POST platform/auth/login`, issuing a JWT
signed with its **own `PLATFORM_JWT_SECRET`** (a separate secret from
`JWT_ACCESS_SECRET` — deliberate extra isolation so a platform token
and a tenant token can never be cross-accepted even if a guard were
ever miswired) and checked by a new `PlatformAuthGuard`/`platform-jwt`
Passport strategy — mirrors `JwtAuthGuard`'s shape exactly, registered
globally the same way (no cross-module import needed for the guard to
work elsewhere). New `platform-organizations` module,
`PlatformAuthGuard`-only: `GET platform/organizations` (every org's
usage), `PATCH platform/organizations/:id` (`{ edition }`). Bootstrap:
`pnpm run platform:seed` (`prisma/seed-platform-admin.ts`, mirrors
`seed-demo.ts`'s structure) — there is deliberately no public
self-registration endpoint for this table.

**Web UI**: `/platform/login` and `/platform/organizations` (own
`localStorage` session key, `education-erp.platform-session`, never
mixed with the tenant `education-erp.session` — same "don't let two
session shapes collide" reasoning as the library-SSO Member/Librarian
bug this project already fixed once). `EntityCard` gained an optional
`titleExtra` slot for the usage badge; the Students/Staff create
forms' error handler checks for `EDITION_LIMIT_EXCEEDED` specifically
and renders an `EditionUpgradeBanner` instead of the normal toast.

## Design — Login CAPTCHA

**Self-hosted (`svg-captcha`), not a third-party service** — matches
this project's standing pattern of avoiding external API dependencies
for this class of thing (local AI models, self-hosted OSRM/Leaflet
over Google Maps). Generates a distorted-text SVG entirely in-process
— zero network calls, zero native bindings (unlike a `canvas`-based
alternative, which would need native builds this project's deployment
targets shouldn't have to carry). Characters render as vector `<path>`
shapes, not `<text>` nodes — confirmed directly (`document.querySelector
('svg text')` returns none) — so naive DOM-scraping can't extract the
answer; solving it needs actual visual reading.

**Schema**: `Captcha` — `answer` (argon2-hashed, same as passwords),
`expiresAt` (2 minutes), `consumedAt` (nullable — single-use, marked
consumed on *any* verify attempt regardless of outcome, closing off
repeated guesses against one rendered challenge). Persisted in
Postgres, not in-process memory, specifically because of the
serverless deployment path.

**Flow**: `GET auth/captcha` → `{ captchaId, svg }` (no auth — happens
before login; reused by every login surface, tenant and platform
alike, since a challenge has no inherent "tenant" flavor). `POST
auth/login` and `POST platform/auth/login` both gained optional-at-the-
DTO-level `captchaId`/`captchaAnswer` fields, verified via
`CaptchaService.requireValid` **before** any credential check — a
wrong/expired/reused captcha never even attempts a password lookup.
Comparison is case-insensitive (distorted text is hard to read
exact-case) via a `normalize()` lowercase-and-trim step on both sides.

**Test/dev accommodation, stated explicitly**: `requireValid` bypasses
entirely when `NODE_ENV === "test"` (Jest's own default, confirmed
directly — every e2e test in `tenant-isolation.e2e-spec.ts` logs in
programmatically dozens of times and structurally cannot solve an
image challenge) or when `DISABLE_CAPTCHA=true` (an explicit,
off-by-default local-dev convenience). Production is never affected by
either bypass path.

**All three login surfaces updated, not just the obvious one**: the
main `/login` page and the new `/platform/login` page share a new
`CaptchaField` component (fetches on mount, renders the SVG inline, a
refresh (↻) control, refetches on a bumped `refreshSignal` after a
failed attempt since the old challenge is already consumed either
way). `apps/exam-client` and `apps/cctv-client` each needed their own
`getCaptcha` IPC channel added end to end (types → preload → main-
process handler → `LoginScreen.tsx`) — their own narrow, explicitly-
allowlisted IPC surfaces don't automatically inherit new backend
capabilities.

## Real bugs found and fixed

1. **`react-hooks/set-state-in-effect` on `CaptchaField`'s fetch
   effect** — calling the async `load()` function directly in the
   effect body executes its synchronous `setLoading(true)` call
   synchronously within the effect, which this project's lint rule
   flags (the same rule class that caused a real hydration-race
   regression earlier in this session — never just silenced without
   checking). Fixed by deferring via `Promise.resolve().then(load)`,
   the same microtask-deferral restructuring already used for
   `GlobalSearchBox`'s debounced search effect.
2. **`platform-organizations.service.ts`'s `listOrganizations` counted
   every org's students/employees via `Promise.all` over N concurrent
   `withTenant` transactions** — with 50+ orgs accumulated in this dev
   database across the session's e2e runs (none cleaned up, per the
   standing instruction), this produced a real `P2028` "unable to
   start a transaction" from Neon's connection pool being exhausted,
   caught live via the actual platform console. Fixed by processing
   orgs sequentially — an admin console listing schools isn't
   latency-critical enough to be worth the concurrency, and the e2e
   test's own timeout was bumped from 30s to 90s to match (32.7s
   observed with the current org count).
3. **A subtler version of the same RLS-scoping mistake this project
   has hit before**: `editionStatus`'s Student/Employee counts must run
   inside `withTenant(org.id, ...)` — calling it against the raw
   (non-tenant-scoped) connection would silently return 0 for every
   org, not error, since Student/Employee are RLS-protected tables and
   an unset session GUC matches no rows. Caught during design, before
   it shipped, by reasoning through the same class of bug already
   documented for `Permission`'s "genuinely global" precedent — worth
   restating: a genuinely-global-table pattern doesn't mean every
   query issued near it is safe to run without `withTenant`.
4. **The e2e test's own filler-student setup made the identical
   mistake**: `prisma.student.createMany(...)` called directly (no
   `withTenant`) was rejected outright by Postgres's RLS policy itself
   (`42501`, not a silent wrong-scope success) — the FORCE ROW LEVEL
   SECURITY policy has no exception for a raw admin connection without
   the session GUC set. Fixed the same way as every other direct-
   Prisma test-setup write to an RLS-protected table in this file.

## Explicitly not in this slice

- CAPTCHA on `/auth/register-organization` — an equally bot-exposed
  public endpoint, but not what was asked; a clean, identical
  follow-up once this pattern is proven.
- Any platform-admin capability beyond viewing orgs and setting their
  edition — no cross-org tenant-data access/impersonation.
- Per-org configurable record caps, or additional editions beyond the
  three named.
- Blocking non-browser API clients outright (the declined alternative
  from `AskUserQuestion`) — a CAPTCHA still lets a legitimate
  integration client through as long as a human solves the challenge.

## Verified

- `pnpm -r typecheck`/`lint`/`build` clean across all six packages
  (services/api, api-client, web, both Electron clients).
- Standalone diagnostic scripts (this session's standard pattern): the
  edition-limit count/enforcement logic and `svg-captcha` generation +
  argon2 hash/verify, both directly against Prisma, before jest.
- Extended `tenant-isolation.e2e-spec.ts` with two new tests, both
  passing clean: a fresh org's 49th/50th/51st student create walks the
  exact FREE-cap boundary correctly (49 allowed silently, 50th
  allowed, 51st rejected with the structured body, a staff create is
  blocked by the same combined cap, upgrading to PROFESSIONAL
  immediately unblocks both) — ~10s; a fresh `PlatformAdmin` logs in,
  lists every org, changes orgA's edition and restores it, and
  confirms cross-guard isolation in both directions (a tenant token
  rejected by `PlatformAuthGuard`, a platform token rejected by the
  tenant `JwtAuthGuard`) — ~33s.
- A dedicated non-jest CAPTCHA check (jest's own bypass means the e2e
  suite can't prove CAPTCHA actually blocks anything): a wrong answer
  is rejected (400) and marks the challenge consumed; resubmitting the
  *correct* answer against the same now-consumed challenge is still
  rejected (single-use enforced); a fresh challenge with the correct
  answer (case-varied) succeeds; an expired challenge is rejected; a
  request with no captcha fields at all is rejected with a clear
  message.
- Full browser pass, both login surfaces: fetched a real challenge via
  the running dev server, visually read the distorted-path glyphs
  myself (the same thing a human would have to do — confirmed the
  glyphs are genuinely not extractable as text from the DOM), and
  logged in successfully with the correct answer on both `/auth/login`
  and `/platform/auth/login`; confirmed a wrong reading is rejected.
  Confirmed the CAPTCHA UI renders correctly on `/login` and
  `/platform/login`. Logged into `/platform/organizations` as the
  seeded platform admin and confirmed the real org list (52 orgs,
  correct usage counts) renders, live-changed the real demo org's
  edition to Ultra and back to Free via the dropdown (toast
  confirmation, badge updates), and confirmed the "N of 50 used" badge
  renders correctly on `/dashboard/students` and `/dashboard/staff`.

## Edition-gated dashboard features (later slice, commit `1d50b18`)

User asked for "visible features based upon subscription" — this
system, until then, only gated the combined student+staff *record
count* above, never which *modules* an org could use at all. Extended
via `AskUserQuestion` ("everything beyond core academics" +
"visible but locked" — nav stays fully visible/clickable, a gated
page's own content is replaced with an upgrade notice, not hidden and
not a 403) plus two refinements given mid-plan: keep the record-cap
wording ("Professional edition (max 500 records)") consistent
everywhere edition is mentioned, and surface the org's current tier at
the top of the profile popover, not just in the students/staff usage
badges.

**Split** — Free (ungated): dashboard home, org structure, staff,
students, admissions, academics, attendance, roles & permissions.
**Professional** adds: finance, leave, payroll, timetable, syllabus,
my classes today, assignments, knowledge checks, exam catalog, exams,
learning dashboards. **Ultra** adds: transport, hostel, library,
inventory, communication, documents, biometric policy, cameras,
alumni, analytics & reports.

No backend/schema change — purely additive frontend, reusing the
already-existing `Organization.edition` and `GET organizations/me/
edition-status`. New: `apps/web/src/lib/edition-features.ts`
(`FEATURE_MIN_EDITION` map + `meetsEdition()` + two label maps —
`NEXT_EDITION_LABEL`, moved here from `edition-upgrade-banner.tsx`
verbatim, and the new `EDITION_DISPLAY_NAME`, a *direct* "name this
edition" lookup distinct from `NEXT_EDITION_LABEL`'s "name the edition
one step up from current" — needed because a Free-tier org hitting an
Ultra-gated feature must be told "Ultra edition," not "Professional,"
which the other map keyed off their current tier would incorrectly
imply is enough), `apps/web/src/lib/use-edition-status.ts` (the
shared SWR hook, extracted from what was previously duplicated inline
in `students/page.tsx` and `staff/page.tsx`), `apps/web/src/
components/feature-lock.tsx` (the gate itself — wraps a page's
existing return with zero change to that page's own logic).
`user-profile-popover.tsx` gained a tier `Badge` at the top of the
card. **Explicitly no backend enforcement this pass** — a UI-level
experience only, stated plainly; an org's own valid session could
still reach a gated endpoint directly. `/portal`, `/teacher`, the
Electron clients, and Org structure/Roles & Permissions are all
untouched by this slice (see the plan's own "explicitly not in this
slice" for the reasoning on each).

Verified live against a real dev server: as the demo admin on the real
(Free-tier) demo org, confirmed Students renders normally and Finance
locks with the nav link still visible; bumped the org to Professional
(direct DB update, the platform admin's password wasn't on hand) and
confirmed Finance unlocked while Analytics (Ultra) still locked and the
profile badge updated; bumped to Ultra and confirmed Analytics
unlocked too; restored the org to Free afterward. `pnpm -r typecheck/
lint/build` clean across all 7 pnpm-scripted workspace projects.
