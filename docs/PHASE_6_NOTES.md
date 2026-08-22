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

## Next step (as of slice 6b)

Slice 6b done, stopped per plan §21 step 17. Next up per the roadmap:
**6c** — camera adapters, the plan's explicit simulated camera source,
`face_embeddings` (pgvector, only ever populated for a consented
`FaceEnrollment` from 6a via this slice's endpoint), `face_match_events`,
and the three-way match result (identified/possible-match/unknown).
This is where NestJS actually starts calling `services/ai` for the
first time. Needs its own go-ahead.

## Slice 6c — camera capture, face matching, human review

User said "go-ahead." This is where 6a's consent and 6b's embedding
service actually connect, and where NestJS calls `services/ai` for the
first time. Two technical risks were verified directly against this
project's real Neon database *before* writing the plan, not assumed:
reading a raw `Unsupported("vector(n)")` column via `$queryRaw`
requires an explicit `::text` cast (an uncast read throws a
deserialization error), and the `<=>` cosine-distance operator works
correctly once cast. Confirmed with the user before planning: a
captured frame's raw image is **kept only when the match result is
uncertain** (`POSSIBLE_MATCH` or `UNKNOWN`) — discarded immediately
for a confidently `IDENTIFIED` frame — so a human reviewer has
something to look at; this was the non-default, more-auditable option
of the two offered, chosen explicitly over the stronger-privacy
default.

## What shipped

Four new tables: `Camera` (`adapterType` — `SIMULATED`/`RTSP`/
`USB_WEBCAM` — is metadata for 6e's future client to key off of; this
backend never connects to a camera itself regardless of type, it only
receives already-captured frames over HTTP), `CameraEvent`
(`capturedImage Bytes?`/`capturedImageType` — null unless at least one
face in the frame came back uncertain, per the confirmed retention
rule; a `Bytes` column since no object storage exists in this project,
Phase 2's own deferred decision, and this is a narrow slice of events
that actually keep an image), `FaceEmbedding` (one per
`FaceEnrollment`, `embedding Unsupported("vector(512)")` — Prisma
generated `vector(512) NOT NULL` directly from the `Unsupported` type,
no manual SQL editing needed — plus `modelVersion`, the model that
actually produced it, for a future migration story if the model ever
changes), `FaceMatchEvent` (`result` — `IDENTIFIED`/`POSSIBLE_MATCH`/
`UNKNOWN` — plus the `reviewedAt`/`reviewedBy`/`reviewDecision` human-
review trail the architecture doc requires for uncertain matches). A
migration ordering gotcha turned up here: `pgvector` had been installed
directly on the real DB back in 6a's spike but was never tracked in
migration history, so a shadow-DB replay failed with "type vector does
not exist" — fixed by inserting a `CREATE EXTENSION IF NOT EXISTS
vector;` migration with an earlier timestamp than the schema migration,
applied to the real DB as an idempotent no-op.

New `AiGatewayService` — one method, a thin `fetch`-based multipart
POST to `services/ai`'s `/v1/face/embed` (Node's built-in `fetch`/
`FormData`/`Blob`, no new HTTP client dependency). The AI service's
response carries `modelName` (which model actually produced the
embeddings) so NestJS records that ground truth rather than trusting
its own possibly-out-of-sync `FACE_MODEL_NAME` env var.

Extended `biometric-policy`: `POST
/organizations/me/biometric/enrollments/:id/photo` — calls
`AiGatewayService`, rejects 400 for zero/multiple faces or a
detection-confidence floor (a good enrollment photo is one clear
headshot — exactly the "what's a good photo" policy 6b deliberately
left to its caller), stores the embedding via a raw-SQL upsert (Prisma
can't set an `Unsupported` column through its normal Client API).

New `camera-events` module: register/list cameras, the ingestion
endpoint (`POST .../cameras/:id/events` — 400s if the org's
`BiometricPolicy` isn't enabled, runs the pgvector similarity search
per detected face against every embedding in the org, classifies
`IDENTIFIED`/`POSSIBLE_MATCH`/`UNKNOWN` against the 6a-configurable
`matchConfidenceThreshold` with a fixed internal "possible match"
band below it), the review-queue list (never the raw image bytes in a
list payload), a `StreamableFile` image-serving route (404 if no image
was kept), and review (`CONFIRMED`/`REJECTED`, 400 if not
`POSSIBLE_MATCH`, 409 if already reviewed — not a silent no-op, same
precedent as 6a's withdraw). **No separate camera simulator was
built** — the ingestion endpoint is adapter-agnostic by design, so any
multipart image POSTed to it during dev/testing already exercises the
same real pipeline a future 6e camera adapter will use. Two new RBAC
resources (`camera`, `face_match_event`; 50 resources total), Super
Admin/Organization Admin only, same as every resource so far.

New `/dashboard/cameras` page — camera registration, a "simulate a
capture" form (camera + image upload, doubling as both the admin UI
and the dev-testing tool for the simulated camera source), and a
review queue rendering the kept image via a blob-fetching component
with Confirm/Reject actions. `/dashboard/biometric-policy` extended
with a per-enrollment photo-upload input.

Test fixtures: no new image asset was committed. Both slices in this
phase reuse InsightFace's own bundled `t1.jpg` (6 faces); since the
enrollment endpoint rejects multi-face photos, two single-face crops
were prepared via a throwaway script for enrollment/verification use,
each confirmed to contain exactly one detectable face — deliberately
avoiding the package's other bundled demo image, a named real
individual's photo.

## Verified

- `pnpm -r typecheck` / `lint` / `build` clean across all four
  packages.
- `services/api` e2e: 51/51, zero regressions. Two new tests: the full
  happy path (enable policy → enroll a student → reject a multi-face
  enrollment photo (400) → upload a real single-face enrollment photo
  → register a camera → ingest the *same* photo as a captured event →
  `IDENTIFIED`, no kept image → ingest a *different* face → not
  `IDENTIFIED`, image kept → 404 on the identified event's image / 200
  on the uncertain one → review it if `POSSIBLE_MATCH`, or confirm a
  400 on attempting to review an `UNKNOWN` → cross-tenant guards
  throughout), plus capture-while-disabled (400) and cross-tenant
  camera/image 404s.
- Full browser pass, as the demo admin: enabled the policy, recorded
  consent, uploaded an enrollment photo (via a direct authenticated
  request using the session's own token — the browser automation tool
  cannot drive a native file-picker dialog, a genuine tool limitation
  stated plainly, same class of gap already hit for `apps/exam-client`
  in 4g), confirmed the UI updated from "no photo yet" to "photo
  captured" after reload, registered a camera through the actual UI
  form, and simulated two captures: the same enrollment photo came
  back `IDENTIFIED` at confidence 1.0 with no kept image; a genuinely
  different face came back `UNKNOWN` at confidence 0.057 (correctly
  nowhere near a match) with an image kept per the retention rule.
  Since that second result landed as `UNKNOWN` rather than
  `POSSIBLE_MATCH` on this exact test pair, the org's threshold was
  temporarily lowered to reclassify that same low-confidence result as
  `POSSIBLE_MATCH` specifically to exercise the review-queue UI itself
  — confirmed the queue correctly rendered the kept image and label,
  clicked Reject, confirmed the "Saved" toast and the queue correctly
  emptying to "Nothing awaiting review." All test data (camera, camera
  events, face-match events, the face embedding, the enrollment) and
  the policy's enabled flag/threshold were reset afterward via a
  cleanup script scoped to the demo org.

## Next step (as of slice 6c)

Slice 6c done, stopped per plan §21 step 17. Next up per the roadmap:
**6d, attendance reconciliation** — wiring a confirmed face match into
the existing `AttendanceSession`/`StudentAttendance`/`StaffAttendance`
models from slice 3b (already flagged there as deferred to here).
Needs its own go-ahead.

## Slice 6d — attendance reconciliation

User said "go-ahead." This closes the loop the architecture doc's own
CCTV flow diagram describes (`... → Confidence Threshold → Attendance
Event → ERP`) by wiring a confirmed biometric identification into the
*existing* attendance models from slice 3b. Two constraints were
already settled by `PHASE_0_ARCHITECTURE.md` §10 — no `AskUserQuestion`
round was needed this slice, both real forks resolved directly from
that language: reconciliation only ever acts on an `IDENTIFIED` result
or a `POSSIBLE_MATCH` **after** a human `CONFIRMED` it ("human review
required for possible match"), and it only ever **fills in** an
attendance record that doesn't exist yet, never overwrites one already
there — manual or otherwise ("the CCTV pipeline augments, never
replaces, the attendance system").

## What shipped

The one genuinely new piece of logic in this slice: mapping a face
match to a specific class period. For a matched student, find their
active `StudentEnrollment` **as of the capture date** (`status:
ACTIVE` filtered by the enrollment's `Term.startDate/endDate`
bracketing `capturedAt` — a student can hold `ACTIVE` rows across
multiple terms, so the term's own date range is what disambiguates
"now"), then look up `ClassSchedule` rows for that section+term on the
capture's ISO weekday, and pick the one whose `Period.startTime`–
`endTime` window contains the capture's time. No match (e.g. an
entrance-camera capture outside any scheduled period) is a normal
outcome, not an error — the identification is recorded, no attendance
action taken. For a matched staff member, no period logic is
needed — `StaffAttendance` is a flat `(employeeId, date)` upsert.

New `AttendanceReconciliationService` (new `attendance-reconciliation`
module, imported into `CameraEventsModule`), given the **same Prisma
tx** `camera-events.service.ts` is already running inside — the
face-match write and any resulting attendance write commit atomically
together. Deliberately does **not** call the existing
`markAttendance`/`markStaffAttendance` service methods, since both
unconditionally `upsert` (overwrite) — exactly the "replaces" behavior
ruled out above; this is new, guarded, create-only logic instead, with
`P2002` unique-constraint races (two concurrent captures landing in
the same period) swallowed as "someone else already handled it," not
a real error — the face-match write itself must never fail because
reconciliation lost a race.

Two nullable columns added directly to `FaceMatchEvent`:
`reconciledStudentAttendanceId`/`reconciledStaffAttendanceId`, set
only when reconciliation actually created a row this call — the audit
trail for "which biometric event caused this attendance record."
Deliberately not a new `attendance_events`/`entry_exit_records` table
(named in the architecture doc's data list) — `CameraEvent`/
`FaceMatchEvent` already **are** that record, same "don't add a second
source of truth" reasoning already applied elsewhere in this project.
No new endpoints, no new RBAC resource — this is a side effect of the
already-permissioned 6c routes; `ingestEvent`/`reviewFaceMatch`/
`listFaceMatchEvents` just gained the two new nullable fields. Web UI:
`/dashboard/cameras`' match display now shows "→ attendance marked"
when reconciliation created a record.

Deliberately **not** in this slice: a configurable grace window around
a period's start/end (exact window only, a fixed simplification
matching `POSSIBLE_MATCH_BAND`'s own precedent); a new
`attendance_events` table; letting reconciliation upgrade an
already-marked record; any change to `apps/cctv-client` (6e, and
nothing here depends on it).

## Verified

- `pnpm -r typecheck` / `lint` / `build` clean across all packages.
- `services/api` e2e: extended the Phase 6 describe blocks with two new
  tests — a student flow (build a same-day, whole-day-period fixture
  computed from the real test-run date to avoid clock/weekday
  flakiness; capture the enrolled photo → `IDENTIFIED` → a
  `StudentAttendance` row is created once with the auto-marked remark;
  capture again → no duplicate; a second, separately-enrolled student
  manually marked `ABSENT` first, then captured → the manual mark is
  confirmed untouched) and a staff flow (capture → `StaffAttendance`
  created once, untouched on a second capture; cross-tenant guard).
  Full suite: 53/53 (2 new, zero regressions).
- Full browser pass (via direct API calls, same hybrid approach as
  6c, since the browser tool can't drive a native file picker):
  simulated a capture during the fixture's period window and confirmed
  the created `StudentAttendance` row and its auto-marked remark.

**A real, fixed bug in the test fixtures, not the product code**:
the staff-reconciliation test initially reused the *same* face photo
as the student test earlier in the same file run. Since both tests
share one org, that created two `FaceEnrollment` rows with **identical
embeddings** — the pgvector nearest-match query legitimately can't
distinguish them, and picked the older (student) enrollment for a
capture meant to identify the newer (staff) one. Fixed by using three
mutually distinct face crops across the describe block (confirmed via
a fresh crop-and-verify pass against the *actual saved JPEG* through
the real AI service — the first version of the third crop had been
verified against the pre-compression in-memory array instead, which
turned out to detect differently than the same content read back after
JPEG compression at a small crop size). **Lesson: when multiple
enrollments exist in the same org across a test file, each needs a
genuinely distinct face — and any fixture-image verification must go
through the exact same read/decode path the real code will use, not a
shortcut that happens to detect successfully at generation time.**

**Also reconfirmed the standing "leaked jest process" lesson yet
again**, and its downstream effects were more varied than seen before:
a `jest` process from an earlier successful run of this file's own new
tests didn't exit, held a stuck connection pool, and caused the *next*
run's `afterAll` to itself fail on a `P2028` — which then left that
run's org data uncleaned, which combined with growing table count to
also require raising the `afterAll` hook's own explicit timeout
(90000 → 180000ms, same class of fix as slice 3c's identical bump for
the same reason: more tables accumulated, cleanup costs more).
Diagnosed and fixed via the exact established protocol (`ps aux` for
strays, time a direct query, retry) before touching any test code.

**A full-suite run also reconfirmed the known token-TTL-vs-runtime
flakiness class** (documented since slice 4f): the file now takes over
1000s end to end, comfortably exceeding the 900s JWT TTL, so a late
cluster of tests (student portal, online exam-taking, and — for the
first time — the Phase 6 blocks) 401'd on a full run while passing
individually when filtered. Confirmed every single full-run failure
was a 401 (no other status code appeared) before concluding this,
rather than assuming. Flagged as a background task
(`task_25655efd`) to actually fix now that it's recurred twice and the
suite keeps growing — not fixed inline, since it's pre-existing infra
debt this slice merely re-exposed, not caused.

## Next step (as of slice 6d)

Slice 6d done, stopped per plan §21 step 17. Next up per the roadmap:
**6e, `apps/cctv-client`** (Electron) — camera monitoring/health, the
attendance-event feed, plus the biometric/RFID/barcode/printer
hardware-adapter surface the plan folds into that same client; nothing
in 6c/6d depends on it, the ingestion endpoint is adapter-agnostic by
design. Needs its own go-ahead.
