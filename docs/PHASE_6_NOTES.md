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

## Next step (as of slice 6a)

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

## Slice 6b — `services/ai` (face detection/embedding, standalone)

User said "go-ahead." This is the project's first Python service.
Before writing any plan, the actual technical risk was verified
directly rather than assumed: a throwaway venv installed `insightface`
+ `onnxruntime` + `fastapi` + `opencv-python-headless` against this
machine's real Python 3.13, and ran a full real detection+embedding
pass — model auto-downloaded from InsightFace's own GitHub release
hosting, 6 faces detected in a bundled test image, a real 512-dim
embedding extracted, `CoreMLExecutionProvider` available on top of
CPU. `EnterPlanMode` was still used (first Python service, genuinely
new tooling territory) but no `AskUserQuestion` was needed — every
fork resolved via precedent or the already-de-risked research.

## What shipped

New `services/ai/` — plain `venv` + `requirements.txt` (no poetry/uv;
nothing in this repo established either convention, and flat
`requirements.txt` is the lowest-friction choice for a first Python
service). Not added to `pnpm-workspace.yaml`/`turbo.json` — different
language ecosystem; `services/*` already globs it textually and pnpm
correctly skips a directory with no `package.json`.

One route: `POST /v1/face/embed` — multipart image in, every detected
face's bounding box + detection confidence + 512-dim embedding out.
Auth via a shared-secret `Authorization: Bearer <AI_SERVICE_API_KEY>`
header (fails closed — 500, not silently-open, if the server-side
secret itself isn't configured), matching this project's existing
internal-trust pattern (e.g. the `app_runtime` DB credential) rather
than inventing heavier internal auth infra for a same-network internal
call. **Deliberately does not decide what counts as "a good enrollment
photo"** (one clear face, high confidence) — that policy belongs to
whoever calls this in slice 6c, not this service; it returns every
face it finds and lets the caller judge. Model name is config
(`FACE_MODEL_NAME`, default `buffalo_l`), not code, per Phase 0's
explicit rule — `buffalo_s` (the model actually exercised during
research) remains available as a lighter override. Nothing is
persisted or logged beyond one request's transient in-memory
processing — no image or embedding storage exists in this slice.

Test fixture: no photo was added to this repo. Tests load the sample
image directly from the already-installed `insightface` package's own
bundled demo asset (`t1.jpg`), avoiding both a named real individual's
photo and adding any new image asset to the project.

**Explicitly not in this slice**: any NestJS integration/proxying
(6c, once `FaceEmbedding` exists to store a result in), any
persistence of images or embeddings, camera adapters, the simulated
camera source, matching logic, and `mypy`/static Python typing
(Pydantic + FastAPI's own request/response validation covers the
practical risk for a service this small).

## Verified

- `pytest` (4/4, ~88s including the real `buffalo_l` model download on
  first run): auth rejected with no key and with a wrong key, a real
  end-to-end call against the bundled test image returning 6 detected
  faces each with a proper 512-length embedding and a plausible
  confidence score, and a malformed-image upload correctly 400s
  instead of crashing.
- Manually booted the server (`uvicorn app.main:app`) and hit it over
  **real HTTP** (not just FastAPI's test client) with `curl`: `/health`
  responds, an authenticated multipart request against the same
  bundled test image returns 6 faces with 512-dim embeddings and a
  0.92 confidence score, and both an unauthenticated and a
  wrong-key request correctly 401. No GUI-automation tool exists in
  this environment for a backend service (same limitation already
  hit for `apps/exam-client` in slice 4g) — this direct-HTTP check is
  the actual verification, not a browser-style pass, stated plainly.

## Next step

Slice 6b done, stopped per plan §21 step 17. Next up per the roadmap:
**6c** — camera adapters, the plan's explicit simulated camera source,
`face_embeddings` (pgvector, only ever populated for a consented
`FaceEnrollment` from 6a via this slice's endpoint), `face_match_events`,
and the three-way match result (identified/possible-match/unknown).
This is where NestJS actually starts calling `services/ai` for the
first time. Needs its own go-ahead.
