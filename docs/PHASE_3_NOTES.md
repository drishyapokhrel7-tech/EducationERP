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

## Next step

Slice 3b done, stopped per plan §21 step 17. Next up per the slice
breakdown in this file's intro: **3c — Syllabus & lesson plans**
(unit → chapter → topic → subtopic → learning objective hierarchy),
which 3d (class sessions / "My Classes Today") needs for its "select
topic" step. Not yet approved by the user — wait for explicit go-ahead
before starting.
