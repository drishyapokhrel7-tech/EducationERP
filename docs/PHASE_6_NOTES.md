# Phase 6 — CCTV / Biometric, built as slices

Companion to [`PHASE_0_ARCHITECTURE.md`](./PHASE_0_ARCHITECTURE.md) and
every prior phase's notes. Phase 6 (plan §20: "Camera adapters,
simulated camera source, local CV pipeline, face enrollment/embedding/
matching, entry/exit, attendance reconciliation, privacy/retention
controls and Electron CCTV/biometric clients"; data model per plan §6/
§11: `cameras, camera_adapters, camera_events, face_enrollments,
face_embeddings, face_match_events, biometric_policies,
biometric_retention_rules`) is the largest jump in novelty of any phase
so far — the project's first Python service, first real camera/CV
pipeline, first `pgvector` usage, and first CCTV/biometric Electron
client, built over genuinely sensitive data (faces, often of minors).
User specified InsightFace's **buffalo** model family
(`buffalo_l`/`buffalo_s`) for face detection/recognition, confirming
Phase 5 (the general AI Gateway) is being skipped for now in favor of
this phase directly.

Sliced the same way every prior phase has been, per the plan's own "do
not implement the entire platform in one operation" instruction (§21
step 17) — confirmed explicitly with the user before starting. Planned
breakdown, dependency-ordered:

- **6a** Privacy/consent foundation (`BiometricPolicy`,
  `FaceEnrollment`) — this slice. Zero capture/recognition capability;
  just the org-wide disable switch and the per-person consent record
  that has to exist before any of that is built.
- **6b** `services/ai` (Python/FastAPI) — the project's first Python
  service. A face-detection/embedding endpoint using InsightFace's
  buffalo models via the `insightface` package + `onnxruntime`.
- **6c** Camera adapters + the plan's explicit simulated camera source,
  `camera_events`, `face_embeddings` (pgvector), `face_match_events`,
  the three-way match result (identified/possible-match/unknown).
- **6d** Attendance reconciliation — wiring a confirmed match into the
  *existing* `AttendanceSession`/`StudentAttendance`/`StaffAttendance`
  models from slice 3b (already flagged there as deferred to here).
- **6e** `apps/cctv-client` (Electron) — camera monitoring, camera
  health, attendance-event feed, plus the biometric/RFID/barcode/
  printer hardware-adapter surface the plan folds into this same
  client.

Each of 6b–6e needs its own explicit go-ahead when reached, same as
every other phase's slices.

## Slice 6a — Privacy/consent foundation

That per-person-consent answer sets the build order: **privacy and
policy scaffolding has to exist before the capability that needs it**
— same reasoning already used for 4e's auth existing before 4f's
exam-taking was built on top of it. So this slice builds zero capture/
recognition capability. It builds the org-level disable switch, the
per-person consent record, and the RBAC/audit boundary around it.
**Nothing in this slice stores or processes an actual face image or
embedding.**

## What shipped

`BiometricPolicy` — one row per organization, **lazy**: no row means
"disabled," the fail-safe default, so no org has to take an explicit
action to end up in the safe state. `enabled`, `retentionDays`
(default 365), `matchConfidenceThreshold` (default 0.75). A `PUT`
upserts; there's no separate "create" step, so Phase 1's registration
flow stays untouched.

`FaceEnrollment` — one row per consented person. The plan's ERD names
one shared `face_enrollments` table (unlike this project's own
Attendance precedent, which splits Student/Staff into separate
tables) — followed here via **two nullable FKs**
(`studentId`/`staffId`) with an app-level XOR check (exactly one must
be set), rather than an untyped `personId` string, keeping real FK
integrity instead of inventing a new polymorphic-reference pattern
this project hasn't used anywhere else. `consentGivenAt`,
`consentGivenBy` (e.g. "self" or a guardian's name — *who* actually
consented, since that's what an audit of this data would need to
answer), `consentWithdrawnAt`, `status` (`ACTIVE`/`WITHDRAWN`). **No
face image or embedding column exists here or anywhere in this
slice** — `FaceEmbedding` itself is 6c's table, created only once
there's an actual pipeline capable of populating it; an empty-forever
table this slice would just be premature schema, the same reasoning
already applied repeatedly in this project (e.g. `Answer` deferred
until slice 4f).

New `biometric-policy` module: `GET`/`PUT
/organizations/me/biometric-policy`, `POST
/organizations/me/biometric/enrollments` (400s if the org's policy
isn't enabled, or if neither/both of studentId/staffId are given),
`GET /organizations/me/biometric/enrollments`, `POST
/organizations/me/biometric/enrollments/:id/withdraw` (409 if already
withdrawn — not a silent no-op). Two new RBAC resources
(`biometric_policy`, `biometric_enrollment`; 48 resources total) —
seeded only onto Super Admin/Organization Admin, same as every other
resource in this project so far (no role beyond those two has *any*
permissions yet), which happens to satisfy the architecture doc's
"strict biometric access control" requirement for this one resource
without needing a new, narrower pattern. Every policy change and
every consent grant/withdrawal writes an `AuditLog` row, reusing the
existing table/pattern from Phase 1.

New `/dashboard/biometric-policy` web page: the org enable/disable
toggle + retention/threshold fields, and a consent-recording
form/list (pick a student or staff member, record who consented and
when, withdraw).

## Verified

- `pnpm -r typecheck` / `lint` / `build` clean across all four
  packages.
- `services/api` e2e: 49/49 — two new tests covering the full
  defaults-to-disabled → enrollment-rejected-while-disabled(400) →
  enable → enroll-a-student → enroll-a-staff-member →
  neither/both-ids-rejected(400) → list → withdraw →
  re-withdraw-rejected(409) chain, plus the standard cross-tenant
  guard (another org's policy is unaffected, withdrawing under another
  tenant's enrollment 404s). Both new tests passed cleanly on the
  first run; the full suite was also run clean beforehand as this
  slice's opening "check the whole app thoroughly" detour (see below).
- Full browser pass: as the demo admin, enabled the org's biometric
  policy, recorded consent for a demo student (guardian-given, per the
  consent model), confirmed it listed correctly with the withdraw
  action, withdrew it, confirmed the record now shows "withdrawn" with
  no further withdraw action available, and disabled the org's policy
  again. All test data removed afterward via a cleanup script scoped
  to the demo org.

## A real environment bug found and fixed before any of this slice's own code was written

Before starting Phase 6, the user asked to first check the whole web
application thoroughly (everything from Phase 1 through slice 4g) —
not a scope change, a verification detour ahead of the approved next
step. That pass found a genuine environment issue, not a code
regression: **a `jest` process from an earlier full e2e run in this
same session had never exited**, silently holding its own stuck Prisma
connection pool against the dev database for hours and degrading every
subsequent test run all session. This is the exact "leaked process"
class already documented in this project from `nest start --watch`
processes in earlier phases — just from `jest` this time. Killing it
brought the suite straight back to 47/47 clean. **Every "flaky" e2e
failure logged earlier in this session traces back to this one leaked
process, not a real regression, not token TTL, not ambient Neon
noise** — an earlier follow-up task suggesting a token-TTL fix was
dismissed as based on a misdiagnosis once the real cause was found.

## Next step

Slice 6a done, stopped per plan §21 step 17. Next up per the confirmed
roadmap: **6b, `services/ai`** — the project's first Python service,
a face-detection/embedding endpoint using InsightFace's buffalo models.
Needs its own go-ahead. Expect real new-territory questions when it's
reached: how the NestJS API authenticates to this new internal
service, Python dependency/venv conventions for this monorepo (none
exist yet), and how to verify a Python service in an environment with
no GUI-automation tool for it (same limitation already hit for
`apps/exam-client` in slice 4g — likely an integration-test-only
verification story again here, stated plainly rather than claiming a
browser-style pass that isn't possible).
