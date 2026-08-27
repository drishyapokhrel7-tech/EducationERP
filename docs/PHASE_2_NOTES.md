# Phase 2 — Student & Academic Core, built as slices

Companion to [`PHASE_0_ARCHITECTURE.md`](./PHASE_0_ARCHITECTURE.md) and
[`PHASE_1_NOTES.md`](./PHASE_1_NOTES.md). Phase 2 (plan §20: Student &
Academic Core) is much larger than Phase 1, so it's being built as a
sequence of coherent, fully-tested slices rather than one pass — this is
the first: completing the Organization hierarchy plan §4 defines
(`Organization → Campus → Faculty → Department → Program → AcademicYear →
Term → Section`), which Phase 1 stopped at `Campus`.

## Slice 2a — Organization hierarchy

## What shipped

Six new tables (`faculties`, `departments`, `programs`, `academic_years`,
`terms`, `sections`), each tenant-keyed and RLS-protected the same way as
Phase 1's tables (`FORCE ROW LEVEL SECURITY`, policy on
`app.current_organization_id`, granted to `app_runtime` not the migration
owner role). A `program.level` field is deliberately free text, not an
enum — plan §1 forbids hard-coding institution-specific structures like
grading/grade-level systems, and a fixed vocabulary would immediately
break for a school (grades 1–12) vs. a college (degree programs) sharing
the same platform.

`GET`/`POST /organizations/me/{faculties,departments,programs,academic-years,terms,sections}`,
each guarded by `JwtAuthGuard` + `PermissionsGuard` with a
`resource:action` pair, following the exact pattern
`organizations.controller.ts` established in Phase 1. Permissions seeded
for the six new resources (54 more permissions: 6 resources × 9 actions),
wired up for Super Admin / Organization Admin only — same reasoning as
Phase 1: no product spec yet for which of Campus Admin / Principal /
Academic Coordinator / Department Head should manage which of these.

Web: `/dashboard/org-structure` — six list+create sections, cascading
selects (Faculty needs a Campus, Department needs a Faculty, ..., Section
needs both a Program and a Term).

## A real gap RLS doesn't cover here, and how it's closed

Postgres foreign-key constraint checks run against the **raw** referenced
table, not the RLS-filtered view a given role would see — this is
documented Postgres behavior, not a bug. Concretely: if org B sends
`POST /organizations/me/faculties` with `campusId` set to org A's campus,
a plain FK constraint would happily insert the row, because the
referenced campus *does exist* in the table — RLS only filters what a
query *returns*, not what a FK check considers to exist. `app_runtime`
having `BYPASSRLS = false` doesn't change this; FK validation isn't a
normal SELECT subject to the role's row-security policies.

So every `create*` method in `org-structure.service.ts` explicitly looks
up the parent (campus/faculty/department/program/academicYear/term)
*through* `PrismaService.withTenant()` before writing the child — that
lookup **is** a normal SELECT, so RLS filters it correctly, and a parent
outside the caller's tenant comes back as not-found → `404`. This is
covered by
`test/tenant-isolation.e2e-spec.ts`'s "rejects creating a child under
another tenant's parent" case, and confirmed manually: org B given org
A's real campus ID gets a 404, not a cross-tenant link.

## A real bug the manual browser pass caught (not the automated tests)

`apps/web`'s `AuthProvider` used `useSyncExternalStore` to read the
localStorage session (added in Phase 1 specifically to satisfy the
`react-hooks/set-state-in-effect` lint rule cleanly). The assumption was
that React's hydration-correction for `useSyncExternalStore` completes
before any effect keyed on the store's value runs. That assumption was
wrong in practice: a cold full-page load of *any* nested dashboard route
(confirmed on both `/dashboard` and `/dashboard/org-structure`, so not
specific to this slice's new page) redirected a **valid, logged-in**
session straight to `/login`, because `DashboardLayout`'s redirect effect
saw the transient `null` from the server snapshot before the correction
landed.

Fixed with an explicit `mounted` flag (`useState(false)` +
`useEffect(() => setMounted(true), [])`), and the redirect effect now
waits for `mounted` before trusting `user`. This *is* the
`react-hooks/set-state-in-effect` pattern the lint rule flags — disabled
inline with a comment explaining why (a one-shot post-hydration flag with
no external-system read is a different thing than what the rule is
actually protecting against, which is exactly what broke here). Also
fixed in passing: the sidebar nav used plain `<a>` tags, forcing a full
page reload on every in-app navigation — switched to `next/link`.

This wasn't caught by unit tests, e2e API tests, or `next build` — none
of them exercise a cold browser load against a pre-existing localStorage
session. It was only caught by manually loading the page in a browser.
Worth remembering for future phases: **the browser pass is not optional
verification for auth-adjacent UI changes**, even when everything else is
green.

## Verified

- `pnpm typecheck` / `lint` / `build` clean across all three packages.
- `services/api` unit tests unchanged and passing (4/4).
- `services/api` e2e: 7/7, including the two new org-hierarchy cases
  (full chain scoping, cross-tenant parent-guard 404).
- `curl` smoke test: full chain created end-to-end for one org; a second
  org's attempts to create a faculty under org A's campus and a section
  under org A's program+term both returned 404; org B's list endpoints
  all returned `[]`.
- Browser pass: register → add campus → navigate to Org structure (cold
  load, this is what caught the bug above) → create a faculty via the
  cascading select UI → toast confirms creation → visible in the list.

Slice done, stopped for a check-in per plan §21 step 17 — user replied
"proceed", taken as approval for the offered default (Staff) rather than
a green light to push through all of Phase 2 unattended.

## Slice 2b — Staff

Six more tables: `staff_types`, `designations`, `employees`,
`employment_history`, `qualifications`, `teacher_profiles` — the Staff
group from plan §6, minus `teacher_subjects` (needs `Subject`, which is
Academic structure, not built yet) and `staff_documents` (needs the
Documents & Certificates domain, a later phase). Same RLS pattern as
every table so far. `employees.userId` is a nullable, unique FK to
`users` — set only for staff who also get a login (teachers, admins);
support/non-teaching staff may never have one.

APIs follow the same shape as slice 2a:
`GET`/`POST /organizations/me/{staff-types,designations,employees}`, plus
per-employee sub-resources
(`/organizations/me/employees/:employeeId/{employment-history,qualifications,teacher-profile}`).
54 more permissions seeded (6 resources × 9 actions), Super Admin /
Organization Admin only, same reasoning as slice 2a. Web:
`/dashboard/staff` — staff types, designations, and an employee
create/list form with three linked selects (staff type, designation,
optional department).

The same FK-vs-RLS gap from slice 2a applies here too: every `create*`
in `staff.service.ts` that takes a parent id
(staffTypeId/designationId/departmentId/employeeId) validates it through
an RLS-scoped `withTenant()` lookup before writing, for the same reason —
Postgres FK checks don't respect RLS. Covered by two new e2e cases
mirroring slice 2a's: the full employee chain scoped correctly, and a
cross-tenant create rejected with 404.

### A real bug the browser pass caught — again, and worse this time

Creating an employee needs **two** simultaneous select choices (staff
type + designation) on one form — slice 2a's forms only ever needed one
selected before the others were touched, so this exact shape hadn't been
exercised yet. Reproduced consistently: selecting the Designation dropdown
silently cleared whatever was already chosen in the Staff Type dropdown
(and vice versa, regardless of order). Root cause: `@base-ui/react`
1.7.0's `Select.Root` — the shadcn Select primitive from Phase 1 — has a
real bug where multiple mounted instances interfere with each other's
value state. Not a coding mistake in this app; the shadcn-generated
`Select` component was used exactly as scaffolded.

This was worse than the slice-2a hydration bug in one respect: it would
have hit the *existing* Section form on `/dashboard/org-structure` too
(Program + Term, two selects, never actually exercised together in slice
2a's manual pass) — a latent bug sitting in already-shipped, already
"verified" code. Fixed by replacing every multi-select form on both pages
with a plain native `<select>`
(`apps/web/src/components/ui/native-select.tsx`), deleting the buggy
shadcn `select.tsx` entirely rather than patching around it — the bug is
in the primitive, and this app has no case that specifically needs its
styling. Re-verified both the new Employee form and the older Section
form hold multiple simultaneous selections correctly after the fix.

**Compounding lesson on top of slice 2a's "browser pass isn't optional":
a single-select smoke test doesn't prove a component is safe once a form
needs two.** When a new slice is the first to combine an existing
primitive in a new shape (two selects on one form, here), re-verify that
shape specifically — don't assume prior single-instance verification
generalizes.

## Verified (slice 2b)

- `pnpm typecheck` / `lint` / `build` clean across all three packages.
- `services/api` e2e: 9/9 (5 from Phase 1 + 2 from slice 2a + 2 new staff
  cases).
- `curl` smoke test: staff type → designation → employee →
  employment-history → qualification → teacher-profile, full chain,
  201/200 throughout.
- Browser pass: cold load of `/dashboard/staff` (no auth-bug regression),
  created a staff type and designation, then — after finding and fixing
  the multi-select bug above — successfully created an employee with both
  selects populated simultaneously; re-verified the Section form on
  `/dashboard/org-structure` the same way.

Both slices done, stopped per plan §21 step 17.

## Slice 2c — Academic structure (subjects/curriculum) + real demo data

User pointed at two real Nepali institution websites
([Samriddhi School](https://samriddhischool.edu.np/) for Pre-School
through +2, [Prime College](https://prime.edu.np/programs/) for
bachelor's/master's) as reference data, then clarified: modern
institutions commonly run the full Pre-School-to-Master's range under
one roof — so this became both a schema slice (Subject/Curriculum, the
`courses`/scheduling half of plan §6 "Academic" deferred to a later
slice once Student enrollment exists to schedule around) and a demo-data
task: one seeded organization spanning that whole range, not two
separate ones.

**Schema**: `Subject` (org-wide catalog), `Curriculum` (one named subject
combination for a `Program` — a program can have several, e.g. +2
Management's five real streams), `CurriculumSubject` (join,
`isCompulsory` flag). `Program` gained three optional fields
(`durationSemesters`, `creditHours`, `entranceExam`) — generic, not
bachelor-specific despite reading that way; free text/nullable, no
hard-coded exam-board enum. Same RLS + FK-vs-RLS parent-guard pattern as
every prior slice (`academics.service.ts`). API:
`GET`/`POST /organizations/me/{subjects,curricula}` +
`POST /organizations/me/curricula/:id/subjects`. Web:
`/dashboard/academics`. e2e suite now 11/11 (2 new academics cases,
same shape as prior slices' parent-guard tests).

**Demo data** (`prisma/seed-demo.ts`, `pnpm run demo:seed`, idempotent):
one organization, **"Everest Academy & College"** — a fictional name,
deliberately not either real institution's actual name/branding, since
literally naming a demo tenant "Samriddhi School" or "Prime College"
would misleadingly imply affiliation with or endorsement by the real
institution. The *structure* is real, sourced from the two sites: 14
programs (Play Group/Nursery/JKG/SKG, Primary Grade 1–5, Secondary Grade
6–10, +2 Management, and six bachelor's programs + MBS with their actual
semester/credit-hour/entrance-exam data), 19 subjects, and 7 curricula —
a shared Primary curriculum (9 subjects), a shared Secondary curriculum
(10 subjects), and +2 Management's five actual subject-combination
options (6 subjects each, verified against the source table subject-for-
subject). Two faculties ("School", "College") under one campus keep the
two wings organizationally distinct while remaining one tenant. Demo
login: `admin@everest-academy.demo` / `DemoPass123!` (synthetic
credential, not a real person).

## Verified (slice 2c)

- `pnpm typecheck` / `lint` / `build` clean across all three packages.
- `services/api` e2e: 11/11.
- `pnpm run demo:seed` run twice — confirmed idempotent (no duplicate
  rows), then verified row counts and content directly against Postgres:
  14 programs with correct metadata, 7 curricula with correct
  subject-count per curriculum (9/10/6/6/6/6/6).
- Browser pass, logged in as the demo admin: cold load of
  `/dashboard/org-structure` shows all 14 programs including credit
  hours/entrance exam metadata; cold load of `/dashboard/academics`
  (first real exercise of this new page) shows all 19 subjects and all 7
  curricula with their correct subject lists; cold load of
  `/dashboard/staff` confirmed no auth-bug regression (correctly empty —
  no staff seeded for this org).

All three slices done, stopped per plan §21 step 17. User replied
"proceed" again for the next check-in; that offer listed "Course/
scheduling" as an option, but re-checking the plan while starting this
slice found that timetable/rooms/periods/teaching-assignments are
actually **Phase 3** scope ("Teaching, Learning, Timetable &
Attendance"), not Phase 2 — a mis-scoping in the prior report, corrected
here rather than carried forward. Phase 2's only genuinely remaining
work was Student lifecycle, Admissions, and Documents/import-export, so
proceeded with Student lifecycle.

## Slice 2d — Student lifecycle

Five tables from plan §6 "Student": `Student`, `Guardian`,
`StudentGuardian` (join, with `relationship` free text and an
`isPrimaryContact` flag), and `StudentEnrollment` (collapsing the plan's
separate `student_enrollments`/`student_programs`/`student_sections`
into one table — which program, section, and term a student is in for a
given stretch is one coherent fact, not three independently-varying
ones, same call made for org-hierarchy and staff), and
`StudentStatusHistory`. Deferred: `student_addresses`/`student_photos`/
`student_identifiers` (no pressing need, easy to bolt on later) and
`student_documents` (needs the Documents & Certificates phase).
`Student.gender` is free text, not an enum, for the same
no-hard-coded-vocabulary reason as `Program.level`.

Same RLS + FK-vs-RLS parent-guard pattern as every prior slice — every
`create*`/`attach*`/`updateStatus` in `students.service.ts` that takes a
parent id (guardianId, programId, sectionId, termId, studentId itself
for sub-resources) validates it through `withTenant()` first. API +
`/dashboard/students` web UI. e2e suite now 13/13 (2 new student cases:
full chain scoping, and a 404 guard test covering *both* a cross-tenant
enrollment attempt and a cross-tenant guardian-attach attempt in one
case, unlike prior slices' single-guard tests — worth doing since this
slice has two independent attach-style endpoints).

Demo seed extended: added the academic-year/term/section chain the
earlier slices' demo data never actually needed (`2026-2027` / `Term 1`
/ three sections), plus three synthetic students (fictional names, not
real people) — one each in Primary, Secondary, and BSc.CSIT — each with
a guardian, to show the full chain populated rather than empty lists.

### A real, general bug — not test-only this time

`PrismaService.withTenant()` wraps every tenant-scoped query in a Prisma
interactive transaction with the client's **default 5000ms timeout**.
That's tight enough that a real read with a nested include (the student
list's `guardians.guardian` include) tripped it in the browser pass —
not a hung transaction, just ordinary latency against Neon (this
project's dev DB is genuinely remote, ap-southeast-1) compounding with
however much overhead an interactive transaction adds. Symptom: `POST
.../students` succeeded (201), the immediate follow-up `GET
.../students` came back `500` with `PrismaClientKnownRequestError:
Transaction already closed`. This would hit **any** slice's list
endpoint under the same conditions, not just this one — it surfaced
here because the student list happens to be the first nested-include
list query exercised in a browser pass with any real latency variance.
Fixed by raising `withTenant`'s transaction timeout to 15000ms
(`prisma.service.ts`). The e2e test-cleanup timeout hit earlier in this
same slice (splitting one mega-transaction of ~20 sequential deletes
into one `withTenant` call per table, see the test file) was a
*different*, test-only instance of the same underlying tightness — both
fixes are complementary, not redundant.

## Verified (slice 2d)

- `pnpm typecheck` / `lint` / `build` clean across all three packages.
- `services/api` e2e: 13/13.
- `pnpm run demo:seed` run twice — idempotent — then verified directly
  against Postgres: 3 students, each with exactly one guardian and one
  enrollment, correct program/section per student.
- Browser pass, logged in as the demo admin: cold load of
  `/dashboard/students` shows all 3 seeded students with their
  guardians (no auth-bug regression); creating a 4th student through the
  UI form initially reproduced the `withTenant` timeout bug above (POST
  succeeded, the list reverted to showing only 3) — after the fix,
  re-tested the same create end-to-end and the 4th student appeared
  correctly. Removed it afterward so the demo org matches the seed
  script's own data exactly.

All four slices done, stopped per plan §21 step 17. User replied
"proceed" for the offered default (Admissions, over Documents/
import-export — chosen because it doesn't need the still-open
object-storage decision and builds directly on Student/Enrollment).

## Slice 2e — Admissions

Two tables, a scoped-down first cut of plan §5's full scope (online
applications, document upload, review, scoring, entrance exams,
interviews, merit lists, approval, admission fees, enrollment,
configurable workflows): `AdmissionApplication` (program applied to,
applicant details, optional guardian name/phone carried on the
application itself rather than requiring a Guardian row up front, score,
notes, a 6-state `AdmissionStatus` including `ENROLLED`) and
`AdmissionStatusHistory` (audit trail, same shape as
`StudentStatusHistory`). Deferred: document upload (blocked on the
still-open object-storage decision, see `PHASE_1_NOTES.md` open items),
admission fees (needs Finance), merit lists (a derived view over
applications, not its own data), configurable workflows (far beyond this
slice).

The interesting part is the **enroll action**
(`POST .../admission-applications/:id/enroll`), the actual bridge
between Admissions and the Student core built in slice 2d: given a
section/term/student-code, it creates a real `Student` (+ a `Guardian` +
`StudentGuardian` if the application had guardian info) + a
`StudentEnrollment`, sets the application to `ENROLLED`, and links
`enrolledStudentId` back to the new student — all in one transaction.
Two business rules enforced server-side (not just UI disabling): only an
`APPROVED` application can be enrolled, and an application can't be
enrolled twice (`enrolledStudentId` already set) — both return 400, not
404 (this isn't a not-found case, it's a valid resource in the wrong
state). `UpdateAdmissionStatusDto` deliberately excludes `ENROLLED` from
the settable statuses — it's reachable only through the enroll action,
which needs data (section, term, student code) a plain status-PUT
doesn't have and has real side effects a status flip shouldn't carry.

Same RLS + FK-vs-RLS parent-guard pattern as every prior slice.
`/dashboard/admissions` UI: application list with inline status-update
and (once `APPROVED`) an enroll form. e2e suite now 15/15, including a
case that specifically checks the two business-rule 400s and a guard
case for both cross-tenant application-creation and cross-tenant
enrollment.

Demo seed extended with three applications spanning the pipeline
(fictional applicants, not real people): one still `SUBMITTED`, one
`UNDER_REVIEW`, and one carried all the way through to `ENROLLED` —
producing the demo org's 4th student, linked back to its originating
application.

## Verified (slice 2e)

- `pnpm typecheck` / `lint` / `build` clean across all three packages.
- `services/api` e2e: 15/15 — including confirmation that the
  `withTenant` timeout fix from slice 2d holds under this slice's larger
  cleanup (5 tables in the delete order now touch admissions).
- `pnpm run demo:seed` run twice — idempotent (application idempotency
  tracked via a `demo-seed:<code>` marker in the `notes` field, since
  `AdmissionApplication` has no natural business key) — then verified
  directly against Postgres: 3 applications at their expected statuses,
  the enrolled one correctly linked to a 4th student.
- Browser pass, logged in as the demo admin: cold load of
  `/dashboard/admissions` (first exercise of this page) shows all 3
  seeded applications correctly, including the enrolled one showing no
  status-editor (by design — an enrolled application is done). Submitted
  a brand-new application, walked it through APPROVED → Enroll live
  through the UI, and confirmed the resulting student appeared on
  `/dashboard/students`. One screenshot briefly looked like a repeat of
  slice 2d's bug (new application missing from the list right after a
  "Saved" toast) — checked the network response before concluding
  anything: the data was already correct server-side, a second
  screenshot showed it rendered, so this was a screenshot-timing
  artifact, not a regression. Removed the test application + student
  afterward so the demo org matches the seed script's own data exactly.

## Slice 2f — Student CSV import/export

## What shipped

`POST /organizations/me/students/import` (multipart, field name `file`)
and `GET /organizations/me/students/export`. Only the CSV half of plan
§20's Documents/import-export scope — real document uploads (transcripts,
certificates) still need the object-storage backend decision
(`PHASE_1_NOTES.md`/`PHASE_0_ARCHITECTURE.md` open items), but a CSV
import/export doesn't touch storage at all: the uploaded file is parsed
in memory via `csv-parse/sync` and discarded, never written to disk
(Multer's default memory storage, no config needed). `student:export` is
just the existing `export` action from the 9-action permission set
(plan §7) on the existing `student` resource — no new permission seed
entry needed.

Import validates and creates row-by-row inside one `withTenant`
transaction: missing required fields, unparseable dates, and duplicate
`studentCode` (both within the file and against existing rows) are
collected as per-row errors and returned alongside the count created —
one bad row doesn't fail the batch (plan §19's "rollback where
practical," applied per-row since each row is an independent insert, not
one where a partial failure would leave related rows inconsistent).
Export streams the caller's org's non-deleted students back as
`text/csv` with a `Content-Disposition: attachment` header, ordered by
`studentCode`.

Web UI: a new "Import/Export" card at the top of `/dashboard/students`
— file input + Import button showing a summary line and a per-row error
list, and an Export CSV button that fetches the response as a `Blob` and
triggers a download via a temporary anchor element (`URL.createObjectURL`
+ `.click()` + `URL.revokeObjectURL`). Two new `api-client` internal
helpers, `requestForm` (multipart, no manual `Content-Type` — the browser
sets the multipart boundary itself) and `requestBlob` (fetches the CSV
response as a `Blob` instead of parsing JSON), alongside the existing
`request` helper.

## Verified (slice 2f)

- `pnpm typecheck` / `lint` / `build` clean across all three packages.
- `services/api` e2e: 17/17, including two new cases — valid rows
  created while invalid/duplicate rows are reported not silently
  dropped, a re-import of already-existing rows reports them as
  duplicates rather than creating them again, import/export both stay
  tenant-scoped (org B importing the same `studentCode` succeeds
  independently, and each org's export contains only its own rows), and
  a malformed CSV returns 400 not 500. Jest's default 5000ms hook timeout
  started failing every test in this file (not just the new ones) on this
  run — `beforeAll`'s module compile + two org registrations over the
  network to Neon no longer fit in 5s. Raised `testTimeout` to 30000 in
  `jest-e2e.json`, the same class of fix as slice 2d's `withTenant`
  timeout: Neon's latency, not the number of tables in the delete order,
  is what's driving these.
- Browser pass, logged in as the demo admin on `/dashboard/students`:
  exported the seeded students, then imported a 3-row CSV with one
  missing-field row and one duplicate `studentCode` row — UI reported
  "1 of 3 row(s) created" with both errors listed by row number, and the
  new student appeared in the list immediately with a success toast.
  (Also spot-checked cross-tenant isolation for `/organizations/me/students`
  directly against Postgres, since e2e already covers it via the API.)
  Removed the test import row afterward so the demo org matches the seed
  script's own data.

## Next step

All six slices done — Phase 2 (plan §20: Student & Academic Core) is
complete, stopped per plan §21 step 17. Remaining out-of-scope items
carried forward, not part of Phase 2: real document uploads (blocked on
the object-storage decision) and Phase 3 (Teaching, Learning, Timetable &
Attendance — courses, class schedules, rooms, periods, teaching
assignments), which is a separate phase, not a Phase 2 remainder.

## Addendum (2026-08-27) — student/staff entry-form photo field

User asked why the staff/student entry forms had no picture module
with a camera/upload option. Investigated directly: neither `Student`
nor `Employee` had ever had a photo field — deliberately deferred at
slice 2d ("`student_photos`... no pressing need yet, easy to add as
columns or tables later without a redesign"), and the only existing
camera-capture UI in the project is Phase 6a/6c's `FaceEnrollment`
flow, which is a different thing entirely: consent-gated, kept only
for uncertain biometric matches, governed by `BiometricPolicy`'s
retention window — not a plain, always-visible identification photo.

Added `photoUrl String?` to both `Student` and `Employee` (one small
migration, `20260827160715_add_student_employee_photo_url`), set only
at creation — neither model has a general edit/update endpoint to add
it to, so this follows the same scope boundary the rest of each
model's create form already has. Reused, not reinvented: the generic
upload endpoint (`FileUploadButton`, LMS discovery slice 8) for a
plain file, and a newly generalized `CameraCapture` component
(`components/camera-capture.tsx`, the same `getUserMedia`-preview-
plus-capture mechanics as `components/library/face-capture.tsx`, but
without that component's library/base64-specific framing) for a live
snapshot — both converge on the same `photoUrl` string via a new
shared `PhotoInput` component used by both the Students and Staff
pages' create forms, with a small circular thumbnail added to each
list row.

Verified: `pnpm -r typecheck`/`lint`/`build` clean (same pre-existing
`sso/page.tsx` lint failure as every other slice this session). The
Browser pane can't drive a real OS file picker or a real webcam, so
verification split accordingly: the "Use camera" toggle was exercised
for real and degraded correctly to `CameraCapture`'s own friendly
error message when the pane's blocked camera access surfaced (not a
bug — the intended fallback path); the file-upload → create-record →
list-thumbnail path was verified end to end via direct authenticated
API calls (upload a real PNG through the live Google Drive storage
backend, create a student and an employee with the resulting url,
confirm both records store it, then reload the real page and confirm
the thumbnail renders — for both Students and Staff). No delete
endpoint exists for either model (confirmed via a `404`), so the two
test records are left in place per this session's standing "don't
clean up test/demo data" instruction.
