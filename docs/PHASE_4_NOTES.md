# Phase 4 — Examination, built as slices

Companion to [`PHASE_0_ARCHITECTURE.md`](./PHASE_0_ARCHITECTURE.md),
[`PHASE_1_NOTES.md`](./PHASE_1_NOTES.md), [`PHASE_2_NOTES.md`](./PHASE_2_NOTES.md)
and [`PHASE_3_NOTES.md`](./PHASE_3_NOTES.md). Phase 4 (plan §20: "Exam
management, question bank, online examination, randomization, autosave/
resume, evaluation, results, report cards and integrity review
signals"; data model per plan §6 "Examination": `exams, exam_types,
exam_schedules, exam_subjects, exam_rooms, exam_attempts, questions,
question_banks, question_options, answers, marks, grades,
grading_schemes, report_cards`) is sliced the same way Phase 2 and 3
were: coherent, independently-shippable, fully-tested units with a
check-in after each, per the plan's "do not implement the entire
platform in one operation" instruction (§21 step 17). Planned
breakdown, dependency-ordered:

- **4a** Exam structure & question banks (`ExamType`, `GradingScheme`,
  `QuestionBank`, `Question`/`QuestionOption`) — the foundation every
  later slice reads from, same role 3a's Timetable played for Phase 3.
- **4b** Exams & scheduling (`Exam`, subjects, rooms, dates) — binds
  question banks and grading schemes to a real exam sitting for a term.
- **4c** Attempts & evaluation (`ExamAttempt`, `Answer`, `Marks`) —
  recording and scoring, admin-facing on a student's behalf, same "no
  student portal yet" pattern as attendance (3b) and assignments (3e).
- **4d** Grades & report cards (`Grade` computed from `GradingScheme` +
  `Marks`, `ReportCard` generation).

**Deliberately not yet scheduled as a slice**: true student-facing
*online* exam-taking — real-time attempts, randomization, autosave/
resume, integrity review signals, and the plan's **Secure Examination
Client** (§12, an Electron app — `apps/exam-client` in the monorepo
layout, §3). This is qualitatively different from every slice shipped
so far, not just bigger: it is the first Electron client in the
project, it requires real student authentication (a standing gap noted
in every phase since 3d's "My Classes Today"), and the plan's Electron
quality gate (§22) demands secure IPC, disabled `nodeIntegration`,
context isolation and a signed build/update strategy — a genuinely
separate body of work. 4a–4d build the real exam data model and
admin-recorded workflows those features will plug into (same
"AI-assisted pieces are Phase 5, this phase builds what they plug
into" reasoning Phase 3's intro already used for the teaching
workflow); the online exam-taking experience and exam-client Electron
app should be raised as their own explicit decision once 4a–4d are
done, not folded silently into this breakdown.

Learning-analytics tie-in (connecting exam marks into the same
teaching/assessment/learning-evidence chain the Phase 3 dashboards
already surface — plan §23 acceptance criterion "Teaching, assessment
and learning evidence form one connected data chain") is left for
Phase 8 (Analytics, Alumni, Reporting) per the phase breakdown, not
built ahead of schedule here.

## Slice 4a — Exam structure & question banks

## What shipped

Four new tables: `ExamType` (a simple institution-defined category —
"Terminal Exam", "Unit Test" — same role `StaffType` plays for
`Employee`), `GradingScheme` (name/code plus a `bands` JSON array of
`{minPercentage, maxPercentage, grade, gpa?, remarks?}`), `QuestionBank`
(anchored to a `CurriculumSubject`, deliberately **not** term-scoped
like `Syllabus` — a bank of questions is reusable across exams and
terms, unlike a syllabus which tracks one term's actual coverage), and
`Question` (belongs to a bank; `questionType` is `OBJECTIVE` or
`SUBJECTIVE` — collapsed from a broader MCQ/true-false/short-answer/
essay taxonomy down to the one distinction that actually changes
behavior: auto-scored-later vs. manually-marked; `OBJECTIVE` carries
`options`/`correctOptionIndex`, `SUBJECTIVE` carries an optional
`modelAnswer` for the human grader only).

A `grade_bands` child table isn't in the plan's flat table list for
this domain and a band has no independent identity/behavior beyond
"one row of this scheme's scale," so `bands` is JSON on `GradingScheme`
itself — same collapsing reasoning already applied to
`KnowledgeCheckQuestion.options` and `Assignment`'s plain score/feedback
fields in Phase 3. `Question.options` reuses the identical JSON-array
pattern.

New `exam-setup` NestJS module (`ExamType`/`GradingScheme`/
`QuestionBank`/`Question` all under one module, same "several related
resources, one module" shape as `syllabus` and `org-structure`) and a
single `dashboard`-style resource split: `exam_type`, `grading_scheme`,
`question_bank`, `question` each get their own resource (34 → 38 total),
granted to Super Admin/Organization Admin per the existing seed
pattern — no new role needed, since "Exam Coordinator" was already in
the plan's seeded role list from Phase 1. New `/dashboard/exam-setup`
UI: three list+create cards (exam types, grading schemes with a
dynamic add/remove band-row form, question banks) plus a drill-down
into a bank showing its questions and a type-aware add-question form
(the options/correct-option fields swap for a model-answer field when
switching OBJECTIVE ↔ SUBJECTIVE, mirroring Knowledge Checks' question
form from slice 3e). e2e suite now 37/37.

## Verified (slice 4a)

- `pnpm typecheck` / `lint` / `build` clean across all three packages.
- `services/api` e2e: 37/37, including two new cases — the full
  create-exam-type → duplicate-code-rejected(409) →
  create-grading-scheme(with two bands) → invalid-band-min>max-
  rejected(400) → create-question-bank → add-OBJECTIVE-question →
  out-of-range-correctOptionIndex-rejected(400) → add-SUBJECTIVE-
  question → options-on-SUBJECTIVE-rejected(400) → fetch-bank-with-
  both-questions-in-sequence-order chain, and the standard
  cross-tenant 404 guards (question bank under another tenant's
  curriculum subject; question under another tenant's bank).
- **A severe, multi-hour Neon degradation episode hit this slice's
  verification pass** — worse than any prior one recorded in this
  project's history (Phase 3 slice 3e's 52-minute/25-timeout episode
  was the previous worst). A full e2e run that normally takes ~400s
  took 2221s with 3 failures including an `afterAll` crash; a
  subsequent run hit a genuine `P1017: Server has closed the
  connection` and cascaded into 29/37 failures. Diagnosed the same way
  every prior episode was: checked for duplicate dev-server processes
  (none found — one clean `node dist/src/main` throughout), timed a
  direct query outside the test harness repeatedly (bounced between
  ~2s and ~4.4s over the episode, versus the ~1-2s normal baseline —
  real degradation, not a fluke), and retried once connectivity looked
  stable again. The retry passed 37/37 cleanly in 423s. **Neither of
  the new exam-setup tests ever failed in any run** — every failure was
  in pre-existing, unrelated tests, confirming this was ambient Neon
  noise, not a regression in the new code.
- **Same P2028 `Unable to start a transaction in the given time` class
  surfaced again during the browser pass** (adding the SUBJECTIVE
  question 500'd once) — checked server logs to confirm the exact
  error class before doing anything, confirmed it was the same
  transient issue (not a code bug, since these are trivial single-row
  `create` calls with no per-input scaling concern, unlike slice 3f's
  `parentDashboard` finding), and a plain retry immediately succeeded
  (201 Created) with the form's state intact — no data was lost.
- **A stale-render timing artifact recurred** (already documented in
  Phase 2 slice 2e): after adding the first OBJECTIVE question, the
  page briefly still showed "No questions yet" despite the server
  returning 201 Created; checked the raw network response before
  concluding anything, and a fresh page-text read a moment later
  showed the question correctly — not a bug, the same lesson slice 2e
  already established: check the actual API response before treating a
  UI-visual gap as a bug.
- Full browser pass, logged in as the demo admin: created an exam
  type, a two-band grading scheme, a question bank scoped to Primary
  Curriculum · Mathematics, one OBJECTIVE question (verified the
  correct-option select population and the rendered "correct: 4"
  summary) and one SUBJECTIVE question (verified the form correctly
  swaps to a model-answer field with no options), and confirmed the
  drill-down lists both questions with their marks. All test data
  removed afterward via a cleanup script scoped to the demo org.

## Slice 4b — Exams & Scheduling

## What shipped

Four new tables binding 4a's static reference data to a real exam
sitting: `Exam` (an `ExamType` + `Term`, with an optional
`GradingScheme` — optional because an exam can exist before its
grading scale is decided, and 4d's grade computation needs it, not
this slice's scheduling), `ExamSubject` (which `CurriculumSubject`s
are examined in this sitting, with `fullMarks`/`passMarks` — unique
per `(examId, curriculumSubjectId)`, so a subject can't be double-
entered), `ExamSchedule` (the date/`startTime`/`endTime` for one
`ExamSubject` — 1:1, since a subject with a written and a practical
component is modeled as two separate `ExamSubject` rows, not one
`ExamSubject` with two schedules), and `ExamRoom` (a join between an
`ExamSchedule` and the existing `Room` model from 3a — deliberately
reusing `Room` rather than a second room registry, and modeled as a
many-to-many join, not a single `roomId` column on `ExamSchedule`,
since a large sitting can legitimately split across multiple rooms).

**The double-booking check for `ExamRoom` is service-level, not a
database constraint** — the one real departure from 3a's precedent.
3a's `ClassSchedule` double-booking (room+day+period+term) is an exact
tuple match, so a flat Postgres `@@unique` index enforces it. Exam
scheduling uses real calendar dates and `HH:mm` time *ranges*, and
"do these two time ranges overlap" cannot be expressed as a flat
unique index — so `addExamRoom` explicitly queries every other
`ExamRoom` booking for the same room on the same date and checks for
overlap (`existing.startTime < new.endTime && existing.endTime >
new.startTime`) before inserting, returning 409 on a genuine conflict.
Documented inline as a deliberate exception to the "prefer a real DB
constraint" default, not an oversight.

New `exam-scheduling` NestJS module, four new RBAC resources (`exam`,
`exam_subject`, `exam_schedule`, `exam_room`; 38 → 42 total, no new
role needed — "Exam Coordinator" was already in the plan's seeded
role list since Phase 1). New `/dashboard/exams` UI: an exam list +
create form, and a drill-down per exam showing each subject with its
marks, a schedule form (or the schedule once set), and a room-
assignment form once scheduled. e2e suite now 39/39.

## Bugs found and fixed

- **`class-validator`'s `@ValidateIf` callback parameter is typed
  `any`**, tripping `@typescript-eslint/no-unsafe-member-access` on
  `dto.questionType` inside 4a's `create-question.dto.ts` (unrelated
  to this slice's own code, but caught while running a full lint pass
  before starting 4b). Fixed by explicitly typing the callback
  parameter as `CreateQuestionDto`.

## This session's Neon-latency saga, and what came of it

This slice's verification hit the same class of transient Neon issue
recorded in every prior slice — a `P2028` transaction timeout on the
first e2e run, cleared on retry — plus a genuine **environment
restart mid-session** (both dev servers and the entire e2e test run
were killed without warning; recovered by restarting both via
`preview_start` from `.claude/launch.json` and re-verifying from
scratch, not by assuming state carried over).

**A second, more serious issue surfaced only in the manual browser
pass, after 39/39 e2e passed**: creating an exam type through the UI
500'd three times in a row, and a direct `curl` to `/auth/login` also
started failing with `P2024: Timed out fetching a new connection from
the connection pool (limit: 29)` — a genuinely different failure mode
from every prior `P2028`/`P1017` blip this session, and one that kept
recurring across several minutes rather than clearing on retry. Ruled
out the standing "duplicate process" explanation first (`ps aux`
showed exactly one clean server process), then confirmed a raw CLI
query against Neon still worked fine (~2.5s) — meaning the exhaustion
was specific to the running API process's own connection pool, not
Neon being globally unreachable. Rather than continuing to retry
against an already-exhausted pool (which only prolongs the
contention), restarted the API server via `preview_stop`/
`preview_start`, which reset its pool from zero — `curl` to
`/auth/login` and to the exam-type endpoint both succeeded
immediately afterward. **Lesson, a new category alongside the
existing "stray duplicate process" and "genuine Neon outage" classes:
a single long-running process's own Prisma connection pool can get
into a stuck/exhausted state under sustained latency without any
duplicate process involved — when a `P2024` connection-pool-timeout
(not a `P2028` transaction-timeout) recurs across multiple direct
`curl` attempts against different endpoints (not just one flaky
request), a clean restart of that one process is the right fix, not
more retries.**

## Verified (slice 4b)

- `pnpm typecheck` / `lint` / `build` clean across all three packages.
- `services/api` e2e: 39/39, including two new cases — the full
  create-exam → add-two-subjects → schedule-each →
  invalid-marks-rejected(400) → invalid-time-range-rejected(400) →
  assign-room → duplicate-room-assignment-rejected(409) →
  overlapping-room-booking-rejected(409) chain, and the standard
  cross-tenant 404 guards (exam under another tenant's term/exam type;
  scheduling under another tenant's exam subject).
- `test/jest-e2e.json`'s global `testTimeout` raised 60000 → 90000,
  and the `afterAll` cleanup hook's own explicit override raised to
  match — the same structural reasoning as every prior bump (2f, 3c,
  3f): the cleanup chain grew by 4 more tables this slice, and the
  dashboards test (already the heaviest in the suite) came within
  ~440ms of the old ceiling on a clean run before the bump.
- Full browser pass, logged in as the demo admin (after recovering
  from the connection-pool episode above): created an exam type, a
  two-band grading scheme, and a room via direct API calls where
  faster than re-driving already-proven 4a UI, then through the actual
  `/dashboard/exams` UI: created an exam, added a Mathematics subject
  (full 100/pass 40), scheduled it (9/1 09:00–11:00), assigned Room
  101 (capacity 30) — each step's rendered output checked against the
  network response. Added a second Science subject scheduled to
  overlap the first (10:00–12:00 same day) and confirmed via direct API
  call that assigning the same room to the overlapping schedule is
  correctly rejected with 409, matching the e2e coverage. All test
  data removed afterward via a cleanup script scoped to the demo org.

## Slice 4c — Attempts & Evaluation

## What shipped

Two new tables: `ExamAttempt` (one row per student per `ExamSubject` —
`status` reuses the existing `AttendanceStatus` enum from 3b
(present/absent/late/excused) rather than a new narrower one, since
the same four values are meaningful for "did this student sit this
exam" as for daily class attendance) and `Marks` (1:1 with
`ExamAttempt` — `obtainedMarks` + optional `remarks`).

**`Answer` (per-question digital responses) is deliberately not
modeled in this slice**, despite being in the plan's flat table list
(§6). This slice's intro already drew the line: true digital
question-answering is part of the deferred "online exam-taking"
scope, not the admin-recorded evaluation this slice covers. Building
`Answer` now would mean also linking `ExamSubject` to a `QuestionBank`
and inventing a scoring flow that only makes sense for a genuinely
digital exam — premature given the real-world case this project's
demo data has modeled throughout (a traditional paper exam, graded by
a teacher, with only the final mark entered). `ExamAttempt` + `Marks`
alone fully cover "evaluation, results" for that case; `Answer` is
left for whenever the online exam-taking slice is actually approved.

**`ExamAttempt` is not roster-based**, unlike `AttendanceSession` (3b)
which computes its roster from active enrollments. An `ExamSubject`
has no direct `sectionId` — it's reached via `CurriculumSubject`,
which can span multiple sections/programs — so there's no clean FK
path to compute "which students should attempt this." Rather than
inventing one, `recordAttempt` follows the same precedent as
`AssignmentSubmission`/`KnowledgeCheckAttempt`: admin picks the
specific student explicitly. Both `recordAttempt` and `recordMarks`
are plain upserts (create-or-update by unique key) rather than a
separate correction endpoint with an audit trail — the plan doesn't
call for an audit trail on exam marks specifically, so a
correction-friendly upsert is proportionate, unlike 3b's
`AttendanceException` (built because attendance correction explicitly
needed one).

Marks entry is rejected (400) for `ABSENT`/`EXCUSED` attempts (a
student who didn't sit the exam has no marks to record) and when
`obtainedMarks` exceeds the `ExamSubject`'s `fullMarks`.

New `exam-evaluation` NestJS module, two new RBAC resources
(`exam_attempt`, `marks`; 42 → 44 total). Extended `/dashboard/exams`'
existing per-exam-subject drill-down with an attempts section: a
student+status picker to record an attempt, and — for any attempt
whose status allows it — an inline marks-entry form that disappears
once marks exist. e2e suite now 41/41.

## Verified (slice 4c)

- `pnpm typecheck` / `lint` / `build` clean across all three packages
  (one real typecheck failure caught and fixed: `NativeSelect`
  requires a `placeholder` prop even for the always-populated status
  selector — added one).
- `services/api` e2e: 41/41 on the first run, including two new cases
  — the full record-present-attempt → record-absent-attempt →
  re-record-as-LATE-upserts-in-place → marks-over-fullMarks-
  rejected(400) → marks-for-absent-student-rejected(400) →
  record-marks → re-record-marks-upserts-in-place →
  list-shows-student-and-marks chain, and the standard cross-tenant
  404 guards.
- `pnpm --filter @education-erp/api test:e2e` needed no timeout
  changes this slice — the suite passed cleanly at the 90000ms ceiling
  set in 4b, confirming that bump was correctly sized.
- Full browser pass, logged in as the demo admin: recorded a PRESENT
  attempt for one student and confirmed the marks-entry form appeared
  with the correct `/ 100` placeholder (from the exam subject's
  `fullMarks`); entered marks and confirmed the row updated to
  "82/100" and the entry form disappeared; recorded a second student
  as ABSENT and confirmed no marks-entry form rendered for them,
  matching the server-side rejection. All test data removed afterward
  via a cleanup script scoped to the demo org.

## Slice 4d — Grades & Report Cards

## What shipped

Two new tables closing out the currently-scheduled 4a–4d breakdown:
`Grade` (1:1 with `ExamAttempt` — a snapshotted `percentage`/`grade`/
`gpa`, matched against the `Exam`'s `GradingScheme.bands` at
computation time) and `ReportCard` (1:1 per `(examId, studentId)` —
aggregate `totalObtainedMarks`/`totalFullMarks`/`percentage`/
`overallGrade`/`overallGpa` across every graded subject a student
attempted in that exam).

**Both are snapshots, not live-recomputed views** — a deliberate
departure from the "computed view over materialized table" reasoning
used elsewhere in this phase (e.g. `syllabus_progress`). A grade is
meant to stay stable even if the grading scheme's bands are revised
later (an institution changing cutoffs after report cards have
already been issued shouldn't retroactively change what a student was
told they earned) — the same reason a `ReportCard` is a real
generated-document record, not a query. `computeGrade` and
`generateReportCard` are both explicit, separate admin actions (not
triggered automatically by `recordMarks`), matching `KnowledgeCheck`'s
`publish` step — grading is a deliberate decision, not a side effect.

`ReportCard` does **not** duplicate its per-subject breakdown as
stored JSON — that's already queryable by joining `Grade` through
`ExamAttempt`/`ExamSubject` for the given exam+student, and storing a
second copy would just be a sync hazard. Only the aggregate figures
(the actual computation over multiple rows) are snapshotted.

New `exam-grading` NestJS module, two new RBAC resources (`grade`,
`report_card`; 44 → 46 total). Extended `/dashboard/exams`' attempts
list with a "Compute grade" button (replaced by the grade once
computed) and added a new "Report card" card: a student picker plus
generate/regenerate action showing the overall result and per-subject
breakdown. e2e suite now 43/43.

## Verified (slice 4d)

- `pnpm typecheck` / `lint` / `build` clean across all three packages.
- `services/api` e2e: 43/43, including two new cases — the full
  grade-without-scheme-rejected(400) → grade-before-marks-
  rejected(400) → compute-grade(82% → "A") →
  recompute-upserts-in-place → compute-second-subject-grade(55% →
  "C") → report-card-with-no-graded-subjects-rejected(400) →
  generate-report-card(aggregates to 68.5% → "B") →
  regenerate-upserts-in-place → fetch-with-subject-breakdown chain,
  and the standard cross-tenant 404 guards. Both new tests, and the
  whole 43-test suite, passed cleanly on the very first run.
- A `P1017: Server has closed the connection` hit the permission seed
  script mid-run (same transient class recorded throughout this
  project) — cleared on a plain retry, no code issue.
- A genuine **mid-slice environment restart** — both dev servers and
  the browser session's connection to them were gone entirely
  (`preview_list` returned empty, `ps aux` showed no server
  processes) partway through this slice. Restarted both from
  `.claude/launch.json` and continued rather than assuming any prior
  state survived; a scratch-log path used earlier in the session
  (`.../scratch_ephemeral/`) had also stopped existing across the
  restart — switched back to the documented per-session scratchpad
  path from the system prompt instead of continuing to guess.
- Full browser pass, logged in as the demo admin: computed grades for
  two exam subjects (85% → "A", 72% → "B") and confirmed each
  "Compute grade" button was replaced by the rendered grade;
  generated a report card and confirmed it correctly aggregated both
  subjects — 157/200 (78.5%) → "B" (GPA 3) — matching the exact
  band-boundary math verified in the e2e suite, with the per-subject
  breakdown listed underneath. Hit one real transient `P2028` 500 on
  the initial students-list fetch (diagnosed via server logs,
  confirmed transient, cleared on reload) before this pass, consistent
  with every other Neon blip this session. All test data removed
  afterward via a cleanup script scoped to the demo org.

## Raising the deferred scope: Slice 4e — Student Portal Authentication

The user asked to raise the deferred online-exam-taking / Secure
Examination Client scope. Both of those hard-depend on a real, logged-
in student identity — this project has had none, at all, since Phase 1
(every phase from 2d onward flagged the gap and built admin-facing
instead). So the first buildable piece is student authentication
itself, planned via `EnterPlanMode` (not just started directly, given
the size and the number of genuinely open architectural questions the
plan text never answers) and confirmed with the user on two forks
before writing any code:

1. **Student login mechanism**: student code + password, not email —
   admin creates the login and sets the initial password directly (no
   system-generated/emailed password, since plan §7 explicitly forbids
   echoing passwords in responses/logs).
2. **Build sequencing**: the actual online exam-taking engine will be
   built as a **web feature first**, with the Electron Secure
   Examination Client added afterward as a hardening/lockdown layer —
   not from the start. Matches the plan's own acceptance criterion
   ("web portals work independently in browsers... Electron is only
   for controlled/offline/hardware needs"). **That work is not part of
   this slice** — it's the explicit next step, and needs its own
   separate go-ahead.

## What shipped

`User.username String? @unique` — a parallel login identifier to
`email`, since `Student.studentCode` is only unique *within* an
organization, unlike `email`. The generated login's username is
`{organizationSlug}.{studentCode}` (e.g.
`everest-academy-college.STU-0001`) — globally unique with one field,
no separate "select your institution" step. `AuthService.login` now
looks up `email` OR `username` with one `identifier` field (the
`LoginDto`'s `email` field — and the api-client's `LoginInput.email` —
were renamed to `identifier` end to end, since keeping the field named
`email` while it silently accepted non-email input would leave a
permanently misleading name in a security-sensitive path).

New endpoint `POST /organizations/me/students/:studentId/create-login`
(in the existing `students` module) — admin-set password only, never
generated or echoed back. New `student-portal` module: one route,
`GET /organizations/me/portal/dashboard`, that resolves the caller's
own `Student` row from `userId` and delegates straight to the
already-existing `DashboardsService.studentDashboard()` from slice 3f
— no duplicated dashboard logic. New `/portal` route tree in
`apps/web` (a minimal student shell, no admin sidebar), and the login
page now decodes the fresh JWT's `roles` claim client-side (routing
convenience only, never an authorization decision) to redirect
students to `/portal` and everyone else to `/dashboard` as before.
Extracted the `StudentSummary` component out of `learning-dashboards/
page.tsx` into a shared `apps/web/src/components/student-summary.tsx`
so the admin view and the new self-service portal render identically
from the same code. Admin UI: a "Create login" action per student on
`/dashboard/students`, showing the generated username once on success.

## Design decisions worth flagging

**Self-service routes are gated differently from every other module in
this project.** Every existing `@RequirePermissions("resource:action")`
check answers "can this role act on *any* row of this resource" — that
doesn't fit "can this specific student see *their own* data and
nothing else." Granting the Student role the existing `student:view`
etc. would let a student call the admin students-list endpoint and see
every student in the org — a real data-leak risk, not a hypothetical
one. Instead, `StudentPortalController` uses `@UseGuards(JwtAuthGuard)`
only — no `PermissionsGuard`, no `@RequirePermissions` — and
`StudentPortalService` derives `studentId` **exclusively** from
`WHERE userId = jwt.sub`, never from a request parameter. There is
nothing for a caller to tamper with: IDOR is structurally impossible on
this route, not just checked for. Any future self-service work (parent
portal, teacher self-service) should follow this same pattern, not the
resource-permission model.

**A synthetic placeholder email** (`{username}@student.local`) is
written to `User.email` at login-creation time — `email` stays
required+unique (not touched by this slice) so something has to go
there, and reusing the already-unique `username` under a reserved
pseudo-TLD is simpler than making `email` nullable across the whole
codebase for one new login path. The student never sees or logs in
with this value; only `username` is ever relayed to them.

## Verified (slice 4e)

- `pnpm typecheck` / `lint` / `build` clean across all three packages.
- `services/api` unit tests: `auth.service.spec.ts` updated for the
  `email`→`identifier` rename and `findUnique`→`findFirst` lookup
  change, 4/4 passing.
- `services/api` e2e: 45/45, including two new cases — the full
  create-login → duplicate-login-rejected(409) →
  login-by-username-succeeds → **each of two students' portal
  dashboards returns only that student's own data (the core IDOR
  guarantee, asserted both ways)** → a non-student user hitting the
  portal endpoint gets 404 (no linked Student row) chain, and the
  cross-tenant 404 guard on `create-login`. All 45 tests, including
  every pre-existing one, passed cleanly on the first run.
- Full browser pass: as the demo admin, created a login for Aarav
  Sharma on `/dashboard/students` (confirmed the response carried no
  `passwordHash` and the generated username matched
  `everest-academy-college.STU-0001` exactly); logged out; logged back
  in with that username + the password just set; confirmed the redirect
  went to `/portal`, not `/dashboard`; confirmed the rendered dashboard
  showed Aarav's own real enrollment data (Primary School · Grade 3 ·
  Term 1), derived entirely server-side from the JWT. Confirmed the
  existing admin login still works unchanged through the renamed
  `identifier` field. All test data (the created User/UserRole/Session,
  and the `student.userId` link) removed afterward via a cleanup script
  scoped to the demo org — reconfirmed via a fresh admin session that
  every student shows "Create login" again.

## Next step

Slice 4e done, stopped per plan §21 step 17. Per the confirmed
sequencing above, next up is the **online exam-taking engine, built as
a web feature** (question rendering from a QuestionBank, randomization,
autosave, submission, the `Answer` table deferred since slice 4c) —
now genuinely unblocked by a real student identity. After that, the
Electron **Secure Examination Client** wraps it as a hardening/
lockdown layer. Neither is part of this slice; both need their own
explicit go-ahead, per this project's established per-slice check-in
rhythm.
