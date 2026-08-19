# Phase 3 — Teaching, Learning, Timetable & Attendance, built as slices

Companion to [`PHASE_0_ARCHITECTURE.md`](./PHASE_0_ARCHITECTURE.md),
[`PHASE_1_NOTES.md`](./PHASE_1_NOTES.md) and
[`PHASE_2_NOTES.md`](./PHASE_2_NOTES.md). Phase 3 (plan §20: "Timetable,
rooms/periods, syllabus, progress, lesson plans, teacher calendar, My
Classes Today, class completion workflow, knowledge checks, assignments,
submissions, grading, teacher/student/parent learning dashboards and
attendance") is at least as large as Phase 2, so it's being built the
same way: coherent, independently-shippable, fully-tested slices with a
check-in after each, per the plan's own "do not implement the entire
platform in one operation" instruction. Planned breakdown, dependency-
ordered:

- **3a** Timetable & scheduling (rooms, periods, teaching assignments,
  class schedules) — the foundation everything else in this phase reads
  from.
- **3b** Attendance (sessions, student/staff attendance, exceptions) —
  needed for the class-completion workflow's "confirm attendance" step.
- **3c** Syllabus & lesson plans (unit → chapter → topic → subtopic →
  learning objective hierarchy).
- **3d** Class sessions and the "My Classes Today" / class-completion
  workflow, tying 3a–3c together.
- **3e** Knowledge checks & assignments (submissions, rubrics, grading).
- **3f** Teacher/student/parent learning dashboards.

AI-assisted pieces of this workflow (lesson-plan generation, knowledge-
check generation, grading assistance, learning analytics) are explicitly
Phase 5 scope (plan §20), not Phase 3 — this phase builds the real data
model and manual workflows those AI features will later plug into.

## Slice 3a — Timetable & scheduling

## What shipped

Four new tables: `Room` (campus-scoped, free-text `roomType` — same
reasoning as `Program.level`: room taxonomies vary by institution type
and plan §1 forbids hard-coding this kind of vocabulary), `Period`
(`"HH:mm"` string times, not a `Time`/`DateTime` column — a period is a
recurring daily slot with no date component), `TeachingAssignment`
(pairs a teacher/subject/section/term — one per section+subject+term,
enforced by a unique constraint), and `ClassSchedule` (places a teaching
assignment into a day-of-week/period/room slot).

`ClassSchedule` denormalizes `sectionId` and `teacherId` off its
`teachingAssignment` — not just convenience. Postgres unique constraints
need real columns to enforce "no double-booking" at the database level,
the same reasoning every prior slice's FK-vs-RLS parent guard applied:
three separate `@@unique` constraints (`termId+roomId+dayOfWeek+periodId`,
`termId+sectionId+...`, `termId+teacherId+...`) mean a double-booking is
rejected by Postgres itself, not only by application logic. The service
layer still pre-checks all three dimensions before insert so a conflict
comes back as a specific `409` message ("Room is already booked...",
"Section already has a class...", "Teacher is already teaching
another class...") instead of a raw constraint-violation error.

`GET`/`POST /organizations/me/{rooms,periods,teaching-assignments,class-schedules}`,
same RLS + FK-vs-RLS parent-guard pattern as every prior slice. 4 new
permission resources seeded (36 more permissions: 4 resources × 9
actions — `student:export`-style actions already existed generically,
nothing new needed there). `/dashboard/timetable` UI: manage rooms and
periods, build teaching assignments, and add weekly schedule entries —
each list renders the full context (e.g. "Monday · Period 1
(09:00–09:45) — Mathematics for Grade 3 with Anita Shrestha in Room
101"). `TimetablePage`'s `submit()` helper additionally surfaces the
API's specific error message (e.g. the 409 conflict text) in the toast
instead of a generic "Failed", the first page to do this — worth
backporting to earlier pages if this becomes the standard.

## Verified (slice 3a)

- `pnpm typecheck` / `lint` / `build` clean across all three packages.
- `services/api` e2e: 20/20, including three new timetable cases — the
  full room→period→teaching-assignment→schedule chain scoped correctly
  to org A, a 404 guard for creating a room under another tenant's
  campus and a teaching assignment under another tenant's section, and
  a 409 case proving all three double-booking dimensions (room, section,
  teacher) are independently enforced, plus the duplicate-teaching-
  assignment-per-section+subject+term 409.
- **Neon connectivity was severely degraded for part of this session**:
  the permission seed script (234 upserts) took ~9 minutes instead of
  its usual well-under-a-minute, and the first full e2e run took 1002s
  instead of ~110s, timing out unrelated pre-existing tests (not just
  the new ones — the tell that this wasn't a logic bug) and even
  expiring a test's JWT mid-run (900s access-token TTL exceeded by the
  suite's own runtime). Root cause: this machine also had two extra
  long-running local API server processes independently holding their
  own Prisma connection pools against the same Neon database (one on
  port 4000 and a stale one on port 4001, unrelated to anything started
  for this slice). Killing both freed the connection budget and the
  suite immediately dropped back to 140s, 20/20 green. **Lesson: if the
  e2e suite (or seed scripts) suddenly get dramatically slower with no
  code change, check for other local processes holding Prisma
  connections against the same database before assuming a query or
  transaction-timeout regression** — `lsof -i :4000` / `:4001` / etc.,
  not just `prisma.service.ts`.
- **The Browser pane's `computer` click action became unreliable
  mid-session** (repeated "pane is currently hidden / may be stuck"
  warnings, and several genuine clicks on a correctly-positioned,
  enabled, in-viewport submit button produced no network request at
  all, confirmed via `getBoundingClientRect()`/`disabled` checks and
  direct network-log inspection — not a coordinate or React-state
  issue). Root-caused as a tool/environment problem, not a product bug,
  by cross-checking every claim two independent ways: the exact same
  button worked once already earlier in the same page (proving the
  form/handler code path itself is correct), and the create + the
  three-way conflict rejection were both independently confirmed via
  direct `curl` against the same running dev server, returning the
  exact `409` + message the service code and the e2e suite both expect.
  A fresh tab restored click reliability enough to complete the one
  browser-verified creation (Room 101 → Period 1 → a new teacher via
  the Staff page → teaching assignment → schedule entry, all rendering
  correctly with live SWR refresh and success toasts), but the second,
  conflict-triggering click never landed even in the fresh tab — so
  that half of manual verification was done via `curl`, not the UI,
  and is noted here rather than silently presented as a full browser
  pass.
- All test data (Room 101, Period 1, the "Anita Shrestha" teacher +
  staff type/designation, the teaching assignment, the class schedule)
  removed afterward so the demo org has no timetable data yet — none
  was planned for this slice, since a "My Classes Today" feature (3d)
  that would actually use realistic schedule data doesn't exist yet.

## Slice 3b — Attendance

## What shipped

Scoped to manual/session-based attendance only: `attendance_devices`,
`attendance_events` and `entry_exit_records` (plan §6's automated-
capture side of the Attendance group) are deliberately deferred to
Phase 6 (CCTV/Biometric), where the capture hardware/pipeline that
would ever populate them actually gets built — building those tables
now would just be unused schema, same reasoning slice 3a used to defer
CCTV-flavored timetable concerns.

Four new tables: `AttendanceSession` (one per class-schedule-slot +
date, unique on that pair), `StudentAttendance` (per-student mark for a
session), `AttendanceException` (audit trail — every *correction* after
the initial mark is recorded here with a reason, same pattern as
`StudentStatusHistory`/`AdmissionStatusHistory`), and `StaffAttendance`
(per-employee-per-day, independent of the class/session model — a
different sub-domain, same reasoning `enrollment` and `admission` were
kept as separate permission resources despite both touching `Student`).

The roster for a session (which students can legally be marked) is
never trusted from client input — it's computed server-side from active
`StudentEnrollment` rows for the session's section, both when a session
is created/fetched (so the UI can render checkboxes) and when marks are
submitted (`markAttendance` rejects any `studentId` not in that roster
with a 400, listing which ones). Marking is a bulk upsert
(`POST .../attendance-sessions/:id/mark`, one call per class, not one
per student — matching how attendance is actually taken); *correcting*
an already-marked student is a **separate** endpoint
(`PUT .../attendance-sessions/:id/students/:studentId`, mandatory
`reason`) that writes an `AttendanceException` row before updating the
status — this distinction (re-mark within the same sitting vs. a
later audited correction) is deliberate, not accidental duplication.

`/dashboard/attendance` UI: open a class-schedule+date to create/reuse
a session, mark the roster in bulk, and a per-row "Correct" action that
reveals a small reason-required inline form calling the correction
endpoint specifically (see bug below — this was *not* wired up
correctly on the first pass). Staff attendance is a separate section on
the same page (single-employee mark, upserts per employee+date).

## Bugs found and fixed via the browser pass

1. **`getSession` was missing `section: true` in its Prisma `include`**
   (only `listSessions` had it) — the frontend's `AttendanceSessionWithRoster`
   type declared `section: Section` unconditionally, so the "Mark
   attendance" card crashed with `Cannot read properties of undefined
   (reading 'name')` the moment a session was opened. `createSession`'s
   plain `.create()` call had the same latent gap (no `section` on its
   return value either, though nothing rendered it directly yet). Fixed
   both service methods so their response shapes actually match what
   the shared client type promises — this class of bug (service
   returns a partial shape, client type asserts more than the runtime
   payload contains) is easy to miss because TypeScript can't catch a
   mismatch across an HTTP boundary; only exercising the real render
   caught it.
2. **The correction endpoint was completely unreachable from the UI on
   first build** — "Save attendance" always called the bulk
   `markAttendance` upsert, even for already-marked students, so
   `AttendanceException` would have shipped as dead code with no way to
   ever populate it. Caught by asking "does this page actually exercise
   every endpoint I built," not by any tool or test (the e2e suite
   *did* test `correctAttendance` directly, which is exactly why this
   gap wasn't visible there — the API is correct, only the UI's routing
   to it was missing). Added a per-row "Correct" action, distinct from
   the bulk re-mark, that requires a reason and calls the correction
   endpoint specifically.

## Verified (slice 3b)

- `pnpm typecheck` / `lint` / `build` clean across all three packages.
- `services/api` e2e: 25/25, including five new attendance cases —
  session creation returns the correct active-enrollment roster and
  stays tenant-scoped, marking a non-enrolled student 400s, creating a
  session under another tenant's class schedule 404s, correcting an
  already-marked record works (with a 404 for correcting a student who
  was never marked — correction isn't a first mark), and staff
  attendance upserts per employee+date and stays tenant-scoped.
- **Root-caused this session's recurring Neon slowness**: eight
  duplicate `nest start --watch` processes (plus a stray static
  `node dist/main.js`) had silently accumulated across the session,
  each holding its own Prisma connection pool against the same Neon
  database. This — not raw network latency — is almost certainly what
  made the permission-seed script and earlier e2e runs so slow
  throughout this session. Killed all of them and started one clean,
  properly-tracked instance; the e2e suite's timing (~207s) is now
  consistent run-to-run. **Lesson, sharper than slice 3a's version:
  don't just check for one stray process — enumerate every listener on
  the relevant port(s) and every matching process name, since these
  accumulate silently across preview_start calls that don't clean up
  after themselves.**
- Full browser pass, logged in as the demo admin: created a room,
  period, teacher, teaching assignment and class schedule (same
  pattern as slice 3a, done via `curl` against the running dev server
  rather than the flaky `computer` click tool — see slice 3a's note,
  the click tool remained unreliable this session too), then in the
  browser: opened an attendance session for that schedule + a real
  enrolled student (Aarav Sharma / Grade 3), marked him Absent, saw the
  session list update to "1 marked" live, used the new Correct action
  to change it to Present with a reason, confirmed the
  `AttendanceException` audit row directly against Postgres
  (`previousStatus: ABSENT, newStatus: PRESENT`), and marked staff
  attendance for the teacher (verified the upsert-on-remark behavior
  via `curl` after another click-reliability failure). All test data
  removed afterward — none was planned as demo data for this slice.

## Slice 3c — Syllabus & lesson plans

## What shipped

`Syllabus` anchors to one `CurriculumSubject` + `Term` (unique pair) —
precise enough to mean "this subject, as taught in this curriculum, for
this term," which matters because the same Subject can appear in
multiple curricula (e.g. Mathematics in both the Secondary curriculum
and several +2 options) with genuinely different syllabi.
`syllabus_versions` is deliberately not modeled — no revision-history
requirement has been specified yet, so `Syllabus` is directly editable
like `Program`/`Subject`, the same "defer until asked" reasoning applied
throughout every prior slice's unspecified scope.

`unit_id chapter_id topic_id subtopic_id` (four separate tables per the
plan's literal listing) collapse into one self-referencing tree,
`SyllabusNode`, with a `level` enum (`UNIT`/`CHAPTER`/`TOPIC`/`SUBTOPIC`)
and a `parentId` — same collapsing reasoning as `StudentEnrollment` and
`ClassSchedule` in earlier slices: all four are the same shape (ordered,
named, nested under a parent). The service enforces the level ordering
itself (a `CHAPTER` must parent under a `UNIT`, a `TOPIC` under a
`CHAPTER`, etc., and a `UNIT` can't have a parent at all) — a 400 with a
specific message names which level was expected. This is a real,
worthwhile validation despite plan §1's "don't hard-code institution-
specific structures" — the four levels and their nesting order are a
property of the workflow itself (plan §8 names exactly these four), not
an institution-specific taxonomy layered on top.

`LearningObjective` attaches to any `SyllabusNode` (not hard-coded to
only the deepest `SUBTOPIC` level, since not every subject needs the
full four-level depth — plan §1 again). `LessonPlan` ties a
`TeachingAssignment` (which already encodes teacher+subject+section+
term) to a `SyllabusNode` — deliberately *not* to a specific
`ClassSchedule` occurrence or calendar date, since a lesson plan is
prepared once and can be reused/referenced across multiple sessions;
binding a lesson plan to one actual dated occurrence is 3d's job (class
sessions / "My Classes Today"), not this slice's.

`/dashboard/syllabus` UI: pick a curriculum-subject + term to open (or
create) its syllabus, build the tree with a level+parent+sequence form
(the parent dropdown is filtered to only the valid required level, so
picking an invalid parent isn't even offered in the UI, though the
server still enforces it independently — UI convenience is not a
substitute for the backend check, same principle as every prior slice's
disabled-until-valid submit buttons), add learning objectives per node
via an inline reveal (same interaction pattern as attendance's
per-student "Correct" action), and create lesson plans referencing any
node in the currently-open syllabus.

## Verified (slice 3c)

- `pnpm typecheck` / `lint` / `build` clean across all three packages.
- `services/api` e2e: 28/28, including three new syllabus cases — the
  full syllabus→unit→chapter→topic→subtopic→objective→lesson-plan chain
  scoped correctly to org A (plus a duplicate-syllabus 409), a node
  whose parent is the wrong level rejected with 400, and the standard
  404 cross-tenant guards for syllabus/node/lesson-plan creation. Also
  bumped the e2e suite's `afterAll` cleanup hook from Jest's default
  30000ms to 60000ms — cleaning 34 tables (four more than slice 3b) is
  now consistently past the default under this session's Neon latency;
  same class of fix as the global `testTimeout` bump from slice 2f, just
  scoped to the one hook that actually needs it.
- Full browser pass, logged in as the demo admin: created a syllabus for
  Secondary Curriculum · Mathematics / Term 1, built the full four-level
  tree (Algebra Basics → Linear Equations → Solving for x → Isolating
  variables) with a learning objective, and created a lesson plan
  referencing the subtopic — all rendered correctly, including the
  parent-level-filtered dropdown and the objective bullet nested under
  its node. One transient `P2028` ("unable to start a transaction")
  surfaced creating the first node — checked for the slice 3a/3b class
  of duplicate-dev-server problem first (found none: exactly one
  `nest start --watch` process, four normally-pooled Neon connections),
  concluded it was a one-off Neon blip rather than the systemic issue,
  and confirmed by simply retrying the same request via `curl`, which
  succeeded immediately. The Browser pane's click reliability and JWT
  expiry (long session, 900s TTL) both recurred again this slice too —
  same worked-around-before pattern: verify via `curl` and/or a fresh
  tab rather than fighting the same stuck click.
- All test data (the syllabus, its four nodes, the objective, the lesson
  plan, and the throwaway teacher/staff-type/designation used to build a
  teaching assignment) removed afterward — none was planned as demo data
  for this slice.

## Slice 3d — Class sessions & "My Classes Today"

## What shipped

`ClassSession` is deliberately a separate model from `AttendanceSession`
(slice 3b), even though both key off the same `(classScheduleId, date)`
pair — the plan lists `attendance_sessions` and `class_sessions` as
separate tables under separate domains, and the class-completion
workflow (plan §8) treats "confirm attendance" and "select actual
topic / record progress / mark completed" as distinct steps with
distinct owners in a real school (attendance is often taken by an aide;
what-was-taught is the teacher's own record). `ClassSession` tracks:
which `LessonPlan` (if any) it followed, the `actualSyllabusNode` (the
topic *actually* covered — may differ from what was planned, which is
exactly the "planned vs actual" distinction plan §8 calls out),
progress notes, a `status` (`SCHEDULED`/`IN_PROGRESS`/`COMPLETED`), and
`completedAt`. `ClassMaterial` attaches simple reference materials
(title + optional URL) to a session — no file upload, same reasoning as
every prior slice touching documents: the object-storage backend is
still an open decision.

`syllabus_progress` is deliberately **not** a stored table. A node's
progress is fully derivable — "is there a `COMPLETED` `ClassSession`
whose `actualSyllabusNodeId` is this node" — so a separate denormalized
table would just be a second source of truth to keep in sync on every
completion. `GET /syllabi/:id/progress` computes it on read instead
(plan §17 explicitly allows "materialized views/aggregation ... where
appropriate" — computed-on-read is the appropriate choice here, not a
stored one, the same class of judgment call as `LessonPlan` reusing
`Syllabus`/`TeachingAssignment` instead of duplicating fields).

**"My Classes Today" is an admin-facing view for a given date, not a
teacher-specific authenticated portal** — no student/teacher/parent
login exists yet (a gap already noted in earlier phases), so
`GET /my-classes-today?date=` surfaces the same data a teacher would
see (every `ClassSchedule` slot recurring on that date's weekday, each
annotated with whether a `ClassSession`/`AttendanceSession` already
exists) from the one auth context that currently exists. Building the
actual per-teacher portal is out of scope until teacher-role
authentication is specified. The completion action itself enforces one
real business rule: `POST .../complete` 400s if `actualSyllabusNodeId`
isn't set yet — a class can't be marked done without recording what was
taught, mirroring the class-completion workflow's own step ordering.

`/dashboard/my-classes-today` UI: date picker (defaults to today), the
day's scheduled classes with an "Open class" action, and — once
opened — a syllabus/topic picker (cascading the same way slice 3c's
lesson-plan form does), a progress-notes field, a materials list/form,
and a "Mark completed" button that's disabled until a topic is
recorded.

## Verified (slice 3d)

- `pnpm typecheck` / `lint` / `build` clean across all three packages.
- `services/api` e2e: 30/30, including two new class-session cases —
  the full My-Classes-Today → open → duplicate-rejected(409) →
  complete-before-topic-rejected(400) → record-progress →
  add-material → complete → syllabus-progress-updates chain, plus the
  standard cross-tenant 404 guards for session creation and progress
  recording.
- Full browser pass, logged in as the demo admin: `/dashboard/my-classes-today`
  correctly defaulted to today's date and showed a class scheduled for
  today's actual weekday (built via `curl`, same proven pattern as
  prior slices — this environment's Browser-pane click reliability has
  been consistently flaky all session and `curl` setup + browser
  verification of the new UI stays the reliable split). Opened the
  class, selected the syllabus and topic (dropdown correctly populated,
  same cascading pattern as slice 3c), recorded progress notes, added a
  material with a working link, and marked the class completed — the
  status updated live in both the session detail card and the
  scheduled-classes list ("SCHEDULED" → "IN_PROGRESS" → "COMPLETED"),
  the "Mark completed" button correctly disabled itself afterward, and
  `GET /syllabi/:id/progress` confirmed the node flipped to `COMPLETED`
  with a `completedAt` timestamp — verified directly against the API,
  not just visually. All test data removed afterward.
- This session hit a genuine `P1001` (database completely unreachable,
  not just slow) applying the first migration, and separately a working
  directory reset mid-session (an environment restart — the session's
  background-task tracking tools also disconnected around the same
  time) that broke a `prisma migrate dev` call with a confusing
  "schema not found" error. Both were diagnosed correctly before
  acting: the `P1001` cleared on a plain retry (no schema/connection
  string change needed), and the "schema not found" was resolved by
  `cd`-ing back into `services/api` rather than touching Prisma
  config — worth remembering that a sudden path-resolution error after
  several successful commands in the same session usually means the
  cwd silently reset, not that something is wrong with the command
  itself.

## Slice 3e — Assignments & Knowledge Checks

## What shipped

AI generation of either (plan §9's AI Knowledge Check/Assignment
Generators) is explicitly Phase 5 scope — this slice builds the real
manual mechanics those generators will later populate, same reasoning
every AI-adjacent piece of this phase has used.

`Assignment` ties to a `TeachingAssignment` and carries the plan's
9-way `submissionType` enum (written/objective/project/practical/file/
image/pdf/link/text), an optional due date, `allowResubmission`, and
`maxScore`. `rubrics`/`rubric_items` are deliberately **not** modeled —
no structured-criteria grading requirement has been specified yet, so a
plain `score` + `feedback` on `AssignmentSubmission` covers "grading and
feedback" (plan §8) for now, the same "defer until asked" reasoning
applied to every prior slice's unspecified scope (syllabus_versions in
3c, syllabus_progress-as-a-table in 3d). `AssignmentSubmission` is one
row per student per assignment — a resubmission (only when the
assignment allows it) overwrites the row and **resets its score/
feedback to null**, since new content invalidates the old grade; without
`allowResubmission` a second submit attempt is a 409, not a silent
overwrite.

`KnowledgeCheck` collapses `knowledge_check` "options" into a JSON array
on `KnowledgeCheckQuestion` itself rather than a separate options table —
same collapsing reasoning as `SyllabusNode`: each option has no
independent identity or behavior beyond "one of this question's
choices." A check starts `DRAFT`; `publish` requires at least one
question and is a one-way transition (`status: PUBLISHED`), after which
`addQuestion` is rejected with 400 — matches plan §8's "teacher review
and publishing required," treating publish as locking the content, not
just flipping a flag. Attempts are rejected with 400 until published,
scored server-side (percentage of questions matching
`correctOptionIndex` — **never trust a client-submitted score**), and
limited to one attempt per student (409 on a second) — these are short
in-class checks, not a retake-until-you-pass assessment; resubmission
rules are an `Assignment` concept, not a `KnowledgeCheck` one.

Neither model has a real student-facing portal yet (no student/parent
login — a gap already noted in every relevant earlier slice), so
submissions and attempts are recorded by admin on a student's behalf,
the same pattern `StudentAttendance` established in slice 3b.

New `/dashboard/assignments` (create, record submissions, grade) and
`/dashboard/knowledge-checks` (create, build questions with a
parent-level-style validated correct-option picker, publish, record
scored attempts) pages, RBAC-guarded API endpoints. e2e suite now 34/34.

## Verified (slice 3e)

- `pnpm typecheck` / `lint` / `build` clean across all three packages.
- `services/api` e2e: 34/34, including four new cases — full
  submit→resubmit-rejected(409)→grade chain, resubmission resetting a
  previous grade when allowed, the full knowledge-check
  create→publish-with-no-questions-rejected(400)→add
  questions→attempt-before-publish-rejected(400)→publish→add-question-
  after-publish-rejected(400)→scored attempt (verified 50% for 1-of-2
  correct)→duplicate-attempt-rejected(409) chain, and the standard
  cross-tenant 404 guards.
- **This session's most severe Neon episode yet, diagnosed correctly
  before making any change**: a full e2e run took 3110s (52 minutes)
  with 25 of 34 tests timing out at Jest's default 30000ms — a much
  worse failure than any prior transient blip. Checked for the
  slice-3a/3b class of duplicate-dev-server problem first: none found
  (zero `nest start`/`node dist/main` processes running). Ran a direct
  timed query against Neon outside the test harness — 943ms cold,
  189ms warm, completely normal — which ruled out sustained Neon-side
  degradation as the cause. Retried the exact same suite with nothing
  else changed: 34/34 passed in 395s, back to normal. **Conclusion:
  this was a one-off, self-clearing anomaly (not a systemic issue,
  not this session's code) — the diagnostic discipline that mattered
  was ruling out the two known causes (stray processes, real Neon
  outage) with actual evidence before accepting "just retry" as the
  fix, rather than retrying blind or, worse, changing timeout
  configuration to paper over what turned out to be nothing.**
- Full browser pass, logged in as the demo admin: created an
  assignment, recorded a submission, graded it (92, with feedback) —
  all rendered live. Built a two-question knowledge check, watched
  "Publish" stay correctly disabled until questions existed, published
  it, recorded a mixed-correctness attempt, and confirmed the UI showed
  the server-computed score (50%) rather than any client-side
  calculation. All test data removed afterward.

## Next step

Slice 3e done, stopped per plan §21 step 17. Next up per the slice
breakdown in this file's intro: **3f — Teacher/student/parent learning
dashboards**, the last slice of Phase 3 — aggregate views over
everything 3a–3e built (timetable, attendance, syllabus progress, class
sessions, assignments, knowledge checks). Likely admin-facing rather
than per-role authenticated portals, same reasoning as "My Classes
Today" in 3d, since no teacher/student/parent login exists yet. Not yet
approved by the user — wait for explicit go-ahead before starting.
