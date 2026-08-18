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

## Next step

Slice 3a done, stopped per plan §21 step 17. Next up per the slice
breakdown above: **3b — Attendance**, since the class-completion
workflow (3d) needs a real "confirm attendance" step to build on, and
attendance is independently useful before 3d exists. Not yet approved by
the user — wait for explicit go-ahead before starting.
