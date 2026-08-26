# Canvas-like LMS — discovery and slice notes

## Discovery pass (no code)

User asked to "verify" a large (30-section) Canvas-like LMS spec
against the existing ERP before any code was written. Ran a full audit
of existing infrastructure (see the discovery report in the
conversation for the exhaustive per-file breakdown) rather than
building blindly, per the spec's own explicit instruction and this
project's standing "one slice at a time, stop for go-ahead" rule.

**What already exists and maps cleanly**: Organization → AcademicYear
→ Term → Program → Section → StudentEnrollment → TeachingAssignment
→ Syllabus/SyllabusNode (Unit/Chapter/Topic/Subtopic tree) →
Assignment/AssignmentSubmission → the real self-service quiz engine
precedent (`exam-taking` module: timer, autosave, shuffle,
auto-scoring) → two proven RBAC patterns (permission-based for admin,
JwtAuthGuard-only self-service for `student-portal`/`driver-portal`).

**What's shaped for a different job**: `Assignment`/
`AssignmentSubmission` are 100% admin-recorded, not self-service, no
file upload. `KnowledgeCheck` is single-MCQ/one-attempt/admin-recorded.
`ClassMaterial` is title+URL only. Marks/Grade vs.
AssignmentSubmission.score are two disconnected grading shapes.
"My Classes Today" and the teacher dashboard are both admin-facing
(permission-gated), not derived from the caller's own identity.

**What's genuinely missing**: teacher self-service login (the biggest
blocker — `Employee.userId` exists but nothing used it for a
JwtAuthGuard-only module), discussions, announcements, persistent
notifications (only ephemeral client-side toasts exist), and **file
storage** — confirmed via `docs/PHASE_0_ARCHITECTURE.md` and every
later phase's notes as a still-open architectural decision since Phase
1, not something this LMS work can assume exists.

**Proposed sequencing** (not all approved yet — each needs its own
go-ahead): 1) teacher portal, 2) course/module content model, 3)
self-service assignments, 4) quiz engine (adapting exam-taking's
proven pattern), 5) announcements, 6) discussions, 7) gradebook, 8)
file upload (blocked on the storage decision), 9) notifications.

## Slice 1 — Teacher self-service portal

User approved starting with #1. Closes the login gap identified in
discovery: teachers had no way to log in and see only their own
classes.

### What shipped

- **No new schema** — reuses `Employee.userId` (already existed,
  unused for this) and every model `TeachingAssignment`/
  `ClassSchedule`/`ClassSession`/`ClassMaterial`/`SyllabusNode` already
  built.
- **Employee login** — the generic `POST organizations/me/employees/
  :id/create-login` endpoint (built in Transport slice 7d-2 for
  drivers) is reused as-is; no role assigned, same reasoning as the
  driver login.
- **`teacher-portal` module** (`services/api/src/modules/teacher-
  portal/`), mirrors `student-portal`/`driver-portal`'s self-service
  pattern exactly — `JwtAuthGuard` only, no `@RequirePermissions`,
  identity derived server-side from `WHERE userId = jwt.sub`, never a
  request param:
  - `GET .../teacher-portal/me` — reuses `DashboardsService.
    teacherDashboard()` wholesale (same "reuse the existing dashboard
    aggregation" precedent as student-portal), scoped to the caller's
    own Employee. 404s if the account has no Employee row **or no
    TeachingAssignment at all** — same "no linked X record" semantics
    as student-portal (Student)/driver-portal (Driver), not just "no
    employee found."
  - `GET .../teacher-portal/today?date=` — same shape as the admin
    "My Classes Today," scoped to only the caller's own
    TeachingAssignment rows.
  - `POST .../teacher-portal/class-sessions` — opens a session for one
    of the caller's own class schedules; idempotent (returns the
    existing session on a repeat call for the same schedule+date)
    rather than the admin endpoint's 409, since a teacher
    double-tapping "open class" shouldn't see an error.
  - `GET/PUT/POST .../class-sessions/:id[/progress|/materials|
    /complete]` — ownership-checked against the session's
    `classSchedule.teachingAssignment.employeeId` before any read or
    write; 404 (not 403) on a session that isn't the caller's own,
    matching this project's IDOR-safe-by-construction convention.
  - `GET .../class-sessions/:id/syllabus-nodes` — new, small addition:
    the admin "actual topic taught" picker browses the full syllabus
    catalog (`syllabus:view`), which a roleless teacher login can't
    reach; this resolves it scoped to exactly the session's own
    subject+term instead.
- **Web**: `apps/web/src/app/teacher/page.tsx` (new top-level route,
  same shape as `/driver` — not under `/dashboard` or `/portal`),
  mirrors `/dashboard/my-classes-today`'s UI closely (open class →
  record progress with a topic picker → add materials → mark
  completed), just scoped to the logged-in teacher. `/login`'s
  existing role-based redirect extended: after the driver-portal
  check, also probes `teacher-portal/me` and redirects to `/teacher`
  on success. `/dashboard/staff`'s Employee list gained a "Create
  login" control (same per-row pattern as the students page's), so
  admins can generate any employee's login from the natural place,
  not just Transport's driver-specific one.
- **api-client**: `TeacherPortalMe` (= `TeacherDashboard`, reused
  type), `TeacherPortalClassToday`, `TeacherPortalSyllabusNode`, and
  the corresponding client methods.

### A real bug found and fixed during browser verification

`getSession`'s ownership-check query only included `classSchedule.
teachingAssignment` (enough to check ownership) but the endpoint
returns that query's result directly to the client, which expects the
full session shape (`materials`, `section`, `lessonPlan`,
`actualSyllabusNode`). Crashed the browser UI with `Cannot read
properties of undefined (reading 'length')` on `materials.length`.
Same bug class already documented in this project (Phase 3's
`getSession` missing `section: true` while the client type declared it
always present) — recurring because it's an easy mistake, not a novel
one. Fixed by using the full `SESSION_INCLUDE` shape everywhere
`loadOwnSession` is called, not just enough for the ownership check.

### A real e2e bug found and fixed

The first e2e run asserted that an employee login with **no**
`TeachingAssignment` 404s on `teacher-portal/me` — it didn't;
`teacherDashboard()` doesn't throw on zero assignments, it just
returns empty arrays, so the endpoint returned 200 with an empty
dashboard. Fixed by adding the "no TeachingAssignment" check to
`getOwnEmployee` itself (shared by every method), matching student-
portal/driver-portal's "no linked X record" 404 semantics.

### Verified

- `pnpm -r typecheck`/`lint`/`build` clean.
- `services/api` e2e: one new comprehensive test (`-t "Teacher self-
  service portal"`) — creates an employee login, gates `teacher-
  portal/me` to an employee with an actual TeachingAssignment (404 for
  one without), returns the correct teaching assignments, opens a
  class session (idempotent on repeat), rejects a different teacher's
  read/progress/materials/complete calls on that session (404, IDOR
  guard), rejects completing before a topic is recorded (400, both for
  the intruder and the owning teacher), records progress, adds a
  material, confirms the syllabus-nodes endpoint, and confirms
  cross-tenant login-creation is rejected (404). Passed clean after
  the two fixes above.
- Full browser pass, as a real teacher login built live in the demo
  org (Everest Academy & College): created a real teacher (Sunita
  Karki), subject (Mathematics), section (Grade 3), room, period,
  teaching assignment and class schedule for today's actual weekday;
  logged in with the generated username/password in a separate tab;
  confirmed the `/login` redirect landed on `/teacher` (not
  `/dashboard`); opened today's class, selected a real syllabus topic
  (imported separately, see below), recorded progress, and marked the
  class completed — full flow confirmed via both the UI and the raw
  network responses. **Per explicit instruction, this demo data was
  deliberately left in place as permanent seed data, not cleaned up.**

## Real B.Ed syllabus + question bank import (Central Deaf Campus / Tribhuvan University org)

Separate from the teacher-portal slice itself: the user pointed at
Tribhuvan University's real, publicly published B.Ed syllabus
(`umc.edu.np/b-ed-syllabus/`, an affiliated campus's syllabus PDF
mirror) and asked for it to be imported, plus quiz questions generated
from it.

- Fetched and read `ED-412.pdf` — "Philosophical and Sociological
  Foundations of Education," First Year, Full Marks 100 — a real
  10-unit course syllabus with unit/chapter/sub-topic numbering that
  maps directly onto this project's existing `Syllabus`/`SyllabusNode`
  (UNIT/CHAPTER/TOPIC) tree.
- Created (in the Tribhuvan University / Central Deaf Campus org,
  `services/api`'s existing admin APIs, no new endpoints needed):
  Subject "Philosophical and Sociological Foundations of Education"
  (ED412), a new "B.Ed First Year Curriculum," the CurriculumSubject
  link, and a Syllabus with **104 SyllabusNode rows** transcribed
  faithfully from the real PDF (10 UNIT nodes, their CHAPTER-level
  subsections, and TOPIC-level sub-subsections where the source has
  them).
- **Question generation**: no LLM/text-generation service exists
  anywhere in this project — the only thing in `ai-gateway` is a face-
  embedding client for biometrics (Phase 6), nothing text-generation-
  capable. Rather than standing up new AI-service infrastructure (which
  would be a large, separate architectural addition and isn't what was
  asked), the questions were generated directly by Claude, grounded in
  the actual syllabus content just read, and loaded into the existing
  `QuestionBank`/`Question` tables via the existing exam-setup domain
  — no new endpoint needed. 20 objective (MCQ) questions, one to two
  per unit, deliberately matching the real course's own stated
  evaluation scheme ("Group A: Multiple choice items — 20 questions x
  1 mark = 20 marks"). Every question and its correct answer is
  directly traceable to a specific fact in the source PDF (unit mark
  weights, named models/agencies/commissions/conferences, the course's
  own evaluation table) — none of it is generic filler.
- **Per explicit instruction, none of this import data was cleaned
  up** — it's permanent seed data in the Tribhuvan University org,
  same as the 76-student roster imported earlier.

## Next step

Teacher portal (slice 1) is done. The rest of the proposed LMS
sequencing (course/module content, self-service assignments, quiz
engine, announcements, discussions, gradebook, file upload,
notifications) is **not started** — each needs its own explicit
go-ahead, per this project's standing rule.
