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

## Slice 2 — Course modules & content

User said "go-ahead" — read as approval to start the next item in the
proposed sequencing.

### Design

**"Course" is not a new entity** — `TeachingAssignment` already is one
(subject+section+term+teacher, the exact granularity `Assignment` and
`KnowledgeCheck` already anchor to). Modules are scoped to it rather
than to `Syllabus` (curriculum-wide, can span multiple teachers/
sections/terms) — module organization is this specific teacher's own
call for this specific class, matching Canvas's own per-course-
instance model without copying its schema.

**New tables** (RLS as usual): `CourseModule` (teachingAssignmentId,
title, description, sequence, isPublished), `CourseModuleItem`
(moduleId, sequence, title, type: PAGE/LINK/VIDEO/DOCUMENT, content,
isPublished — PAGE's content is the rich text itself, the other three
are an external URL, same "link, don't upload" precedent as
`ClassMaterial` since no object storage exists), `CourseModuleItem
Completion` (moduleItemId, studentId, completedAt — just a timestamped
join row; module-level "3/5 complete" is computed on read, same
"computed, not stored" precedent as `syllabus_progress`).

**Two new self-service surfaces, no admin CRUD**: matches the already-
established principle that "a self-service endpoint... needs a new
guard/pattern, not a workaround" — module content belongs to the
teacher who owns the course, not a generic staff permission.
- `teacher-portal` (new methods): list/create/update modules,
  add/update items — every write ownership-checked against
  `module.teachingAssignment.employeeId` (or the schedule's, for
  session-adjacent flows already there). A different teacher gets 404,
  not 403, same IDOR-safe convention as everywhere else in this
  project.
- `student-portal` (new methods): `listCourses` (every
  `TeachingAssignment` matching the student's own active
  `StudentEnrollment.sectionId`+`termId` — "enrolled in a course" is
  structural, never trusted from a param), `listModules` (published
  modules/items only, each annotated with the caller's own completion
  status), `completeModuleItem` (upsert, idempotent — completing twice
  doesn't error or duplicate; 404 if the item or its module isn't
  published, or the student isn't actually enrolled in that course).

**Web**: `/teacher` gained a "My courses — modules" card (course
picker → module list with publish/unpublish toggles → expand a module
to add/publish items). `/portal/courses` (new nav link) lists the
student's enrolled courses; `/portal/courses/[teachingAssignmentId]`
shows published modules, renders PAGE items as text and LINK/VIDEO/
DOCUMENT items as an outbound link, with a per-item "Mark complete"
button and a module-level completion badge.

### A real e2e cleanup bug found and fixed

First test run passed the test itself but the suite's shared `afterAll`
cleanup crashed: `course_modules.teachingAssignmentId` is a RESTRICT
FK, and the three new tables weren't in `deleteOrder` yet, so deleting
`teachingAssignment` before its `course_modules` children failed with
a real Postgres FK violation — the exact "add every new table to
deleteOrder" discipline this suite has followed since slice 1, just
missed once. Fixed by inserting `courseModuleItemCompletion` →
`courseModuleItem` → `courseModule` immediately before `classSchedule`/
`teachingAssignment` in the list (also ahead of `student`, which
`courseModuleItemCompletion.studentId` RESTRICTs against). The two
orgs orphaned by the failed cleanup were removed by hand afterward
using that same fixed order, confirming it now cleans up correctly
end-to-end.

### Verified

- `pnpm -r typecheck`/`lint`/`build` clean.
- `services/api` e2e: one new comprehensive test (`-t "Course
  modules"`) — a different teacher can't create a module on someone
  else's course (404); creates a published module with a published
  item and a draft module with an unpublished item; an enrolled
  student's `listCourses`/`listModules` return only the published
  module and only its published item, with `completed: false`;
  completing an unpublished item 404s; completing the published item
  works and is idempotent on a second call; a student with no
  enrollment in that section+term 404s on the same endpoint; cross-
  tenant module creation on org A's course from org B is rejected
  (404). Passed clean after the deleteOrder fix.
- Full browser pass in the Everest Academy demo org: as the real
  teacher (Sunita Karki) built earlier for slice 1, created "Module 1
  — Numbers and Counting" with a PAGE item, published both; as the
  real enrolled student (Aarav Sharma, given a real portal login for
  this pass), confirmed `/portal/courses` lists Mathematics, opening it
  shows the published module and item, and "Mark complete" flips the
  item to "Done" and the module badge to "1/1 complete" — confirmed via
  both the UI and the underlying network responses. Also re-verified
  the teacher-side UI shows the same module with a working Publish/
  Unpublish toggle. **Per the same standing instruction as slice 1,
  this demo data (module, item, Aarav Sharma's new login) was left in
  place, not cleaned up.**

## Slice 3 — Self-service assignments

User said "go-ahead" — approval to start the next item in the proposed
sequencing.

### Design

**No new entity** — `Assignment`/`AssignmentSubmission` already
existed (admin-recorded, per discovery). The gap was purely access:
admin-only create/grade, no publish gate, no self-service submit path.
This slice extends the existing tables and reuses `AssignmentsService`
wholesale from both portals, rather than forking the grading/
resubmission logic — the "reuse the existing service, add a
self-service ownership check in front" precedent already used for
`DashboardsService`/`FinanceService`.

**One new field**: `Assignment.isPublished` (default `false`) — same
publish-gating precedent as `CourseModule`/`CourseModuleItem`; every
pre-existing admin-created assignment reads as an unpublished draft
under the new field, not silently visible to students.

**`teacher-portal`** (new methods): `listAssignments`/
`createAssignment`/`getAssignmentDetail`/`updateAssignment`/
`gradeSubmission` — every one ownership-checked against
`assignment.teachingAssignment.employeeId` (or the dto's
`teachingAssignmentId` for create) before delegating to
`AssignmentsService`. A different teacher's assignment 404s, matching
the IDOR-safe convention used everywhere else.

**`student-portal`** (new methods): `listAssignments` (published-only,
scoped to the student's own active enrollment's section+term, each
annotated with `mySubmission` — never another student's), `getAssignment`
(same published+enrolled gate), `submitAssignment` (delegates to
`AssignmentsService.submit`, which already has resubmission/grade-reset
logic from the earlier admin-only phase — reused, not reimplemented).
Draft assignments and assignments outside the student's own enrolled
course both 404, not just "not found because unpublished" as a
distinguishable case — same "never leak existence" convention as
course modules.

**Web**: `/teacher`'s existing course picker (shared `courseId` state
with the modules card, slice 2) gained a "My courses — assignments"
card: assignment list with due date/submission count/publish toggle,
expand-to-create form, expand-to-show-submissions with a per-submission
inline grade form. `/portal/assignments` (new nav link) lists published
assignments with a status badge (score if graded, submission status, or
"Not submitted"); `/portal/assignments/[assignmentId]` shows
instructions, the student's own submission/grade/feedback, and a
submit/resubmit form (a plain Tailwind-styled `<textarea>` — no
shadcn Textarea component exists in this project, and one wasn't
introduced for this single use).

### Verified

- `pnpm -r typecheck`/`lint`/`build` clean across all six packages.
- `services/api` e2e: one new comprehensive test (`-t "Self-service
  assignments"`) — a different teacher can't create an assignment on
  someone else's course (404); a draft assignment is invisible to an
  enrolled student (empty list, 404 on direct get/submit); publishing
  makes it visible; an unenrolled student 404s; submission succeeds
  (201, `SUBMITTED`); resubmission is blocked when
  `allowResubmission=false` (409); a different teacher can't grade it
  (404); the owning teacher's `listAssignments` shows the submission
  with the student's info; grading succeeds; the student sees the
  `GRADED` status, score, and feedback, with the response confirmed to
  carry no other student's submission data; cross-tenant access
  rejected throughout (404). Passed clean (`44100 ms`) on the first
  run — no bugs found this slice.
- Full browser pass in the Everest Academy demo org: as the real
  teacher (Sunita Karki), created and published "Counting Practice
  Worksheet" (Mathematics, due 2026-09-15, 10 points, resubmission
  off) — confirmed 201/200 via network responses; as the real student
  (Aarav Sharma), confirmed `/portal/assignments` lists it with a "Not
  submitted" badge, opened the detail page, submitted a real answer —
  confirmed 201 via network response and the page updating to show
  `SUBMITTED`; switched back to the teacher, confirmed the submission
  appeared under the assignment (student name, submitted time, content)
  with a grade form, graded it (9/10, written feedback) — confirmed 200
  via network response; switched back to the student and confirmed the
  detail page now shows `GRADED`, "Grade: 9 / 10", the feedback text,
  and correctly blocks further resubmission. **Per the same standing
  instruction as slices 1 and 2, this demo data (the assignment, Aarav
  Sharma's submission, and the grade) was left in place, not cleaned
  up.**

## Slice 4 — Quiz engine

User said "go-ahead" — approval to start the next item in the proposed
sequencing.

### Design

**No new "quiz" entity** — `KnowledgeCheck`/`KnowledgeCheckQuestion`/
`KnowledgeCheckAttempt` already existed (from Phase 3), already
anchored to `TeachingAssignment`, already had a DRAFT/PUBLISHED gate
and a one-attempt-per-student unique constraint. What was missing,
per discovery, was the self-service *taking* experience: the existing
`attempt()` method is admin-recorded — one bulk call with a
`studentId` param and a full `answers` array, no shuffle, no
autosave, no resume, no per-student time limit. This slice adapts
`exam-taking`'s already-proven engine (`seededShuffle`, deterministic
per-attempt question/option order, translate-shuffled-index-back-to-
real before storing, never trust a client-submitted score) onto
`KnowledgeCheck` rather than forking a parallel implementation —
`exam-taking/shuffle.ts`'s `seededShuffle` is imported directly
(a pure function, no service dependency) into `KnowledgeChecksService`.

**Schema, additive only** (existing admin flow untouched):
`KnowledgeCheckAttempt` gained `startedAt` (nullable — set only by the
self-service flow) and `answers`/`score`/`submittedAt` all became
nullable (previously required, since the admin path always set them
atomically; a self-service attempt now exists in a real "started, not
yet submitted" state first). New table `KnowledgeCheckAnswer`
(`knowledgeCheckAttemptId`, `questionId`, `selectedOptionIndex`) is
the per-question autosave state — mirrors `exam-taking`'s own `Answer`
table exactly, scoped to `KnowledgeCheckAttempt` instead of
`ExamAttempt` since a quiz isn't tied to an exam schedule/window. Both
the self-service and admin-recorded paths still share the same
`@@unique([knowledgeCheckId, studentId])` row and constraint, so
neither can double up on the other — an admin can't record a second
attempt for a student who already self-attempted, and vice versa.

**Self-service quiz-taking, added directly to `KnowledgeChecksService`**
(not a new dedicated module — `exam-taking`'s own module-per-domain
split predates this session's LMS convention of extending the
existing owning service): `getPublishedCheckSummary`/`startAttempt`/
`saveAnswer`/`submitAttempt`. `startAttempt` is idempotent (resumes an
in-progress attempt on a second call, same convention as
`TeacherPortalService.createSession`) and 409s only once actually
submitted. `durationMinutes` (existing field, previously unenforced)
now drives a real per-student deadline computed as
`startedAt + durationMinutes` — `saveAnswer` rejects past it (400);
`submitAttempt` doesn't re-check it, same as `exam-taking`'s own
`submitExam`, since a client-side auto-submit-on-timeout is the
intended backstop, not a hard server cutoff on the final call.

**Two new self-service wrapper layers, same "reuse the existing
service, add an ownership/enrollment check in front" precedent as
assignments and modules**:
- `teacher-portal` (new methods): `listQuizzes`/`createQuiz`/
  `getQuizDetail`/`addQuizQuestion`/`publishQuiz` — every write
  ownership-checked against `knowledgeCheck.teachingAssignment.
  employeeId` before delegating to `KnowledgeChecksService`'s already-
  tested create/add-question/publish/get methods (reads are a direct
  tx query, same split `listAssignments` already uses).
- `student-portal` (new methods): `listQuizzes`/`getQuiz`/`startQuiz`/
  `saveQuizAnswer`/`submitQuiz` — every call enrollment-checked
  (published + the student's own active enrollment covers the quiz's
  `teachingAssignmentId`) before delegating into
  `KnowledgeChecksService`'s new self-service methods. `listQuizzes`
  never returns question content, only metadata + the caller's own
  attempt status — question content (and the deterministic shuffle)
  is only ever revealed by actually starting the quiz.

**Web**: `/teacher` gained a "My courses — quizzes" card (course
picker → quiz list with publish toggle and a fixed 4-option MCQ
builder whose "correct answer" dropdown re-populates live from
whatever option text has actually been typed → expand a quiz to see
its questions and every student's attempt/score). `/portal/quizzes`
(new nav link) lists published quizzes with a status badge (score if
graded, or a Start/Resume link); `/portal/quizzes/[quizId]` is a close
structural mirror of `/portal/exams/[examSubjectId]` — countdown timer,
autosave-on-select radios, auto-submit at zero, a confirm-before-submit
button — with the subjective/textarea branch removed (every
`KnowledgeCheckQuestion` is objective) since a quiz has no subjective
question type to support.

### A real e2e bug found and fixed (unrelated to this slice's own code)

The first full-suite-relative test run failed everywhere with `431
Request Header Fields Too Large` — even re-running the already-passing
slice 3 test hit the identical error, confirming it wasn't caused by
this slice's changes. Root cause: this project's own documented
stopgap for JWT header growth
(`NODE_OPTIONS=--max-http-header-size=65536`) is wired into the
`test:e2e` **npm script**, not applied globally — invoking `jest`
directly (bypassing `npm run test:e2e`) silently drops it. Fixed by
always running e2e tests through `npm run test:e2e -- -t "..."`, never
`npx jest` directly. Once run correctly, this slice's own test needed
one real fix of its own: its `it()` block's fixture-building chain (a
full campus→...→teachingAssignment→two logins→quiz→two questions→
publish→start→resume→submit→grade-review sequence) took longer than
the default 60s timeout against the real dev database; raised to
90000ms, same as this suite's other longer fixture-heavy tests.

### Verified

- `pnpm -r typecheck`/`lint`/`build` clean across all six packages.
  (One unrelated pre-existing lint failure in `apps/web/src/app/sso/
  page.tsx`, from an earlier, already-committed, unrelated change —
  confirmed via `git log` on that file before this slice touched
  anything — is out of scope here and was left alone.)
- `services/api` e2e: one new comprehensive test (`-t "Quiz engine"`)
  — a different teacher can't create a quiz, add a question, or read
  quiz detail on someone else's course (404, IDOR guard); publishing
  with zero questions is rejected (400); a draft quiz is invisible to
  an enrolled student (empty list, 404 on direct get/start); publishing
  makes it visible; an unenrolled student 404s; starting returns
  shuffled questions/options with no `correctOptionIndex` leaked and a
  deadline computed from `durationMinutes`; autosaving both answers
  succeeds; a second start resumes the identical shuffled order with
  the saved answers pre-selected (no reshuffle on refresh); submitting
  auto-scores correctly (1 of 2 correct → 50, never trusting a
  client-submitted score); resubmission and further answer edits are
  both rejected once submitted (409); the owning teacher's quiz list
  shows the graded attempt with the student's info and score, while a
  different teacher still can't reach it at all (404); cross-tenant
  quiz creation on org A's course from org B is rejected (404). Passed
  clean (`55907 ms`) after the timeout fix above — no bugs found in
  this slice's own application code.
- Full browser pass in the Everest Academy demo org: as the real
  teacher (Sunita Karki), created "Addition Basics Quiz" (Mathematics,
  15-minute limit) with two questions via the dynamic 4-option builder,
  published it — confirmed 201/201/201/201 via network responses; as
  the real student (Aarav Sharma), confirmed `/portal/quizzes` lists it,
  started it and confirmed the countdown timer, shuffled question
  order (question 2 displayed before question 1) and shuffled option
  order all render correctly; selected the correct answer for one
  question and an incorrect answer for the other (both autosaved,
  confirmed 200 via network responses); reloaded the page mid-quiz and
  confirmed the identical shuffled order and both previously-saved
  answers were still selected, with the countdown continuing rather
  than resetting — proving resume works, not just a fresh shuffle;
  submitted and confirmed a score of 50 via both the network response
  and the rendered "Score: 50%" on the list page; switched back to the
  teacher and confirmed the quiz's expanded view shows "1 attempted"
  and "Aarav Sharma — 50%" in the attempts list. **Per the same
  standing instruction as slices 1–3, this demo data (the quiz, its two
  questions, and Aarav Sharma's attempt) was left in place, not cleaned
  up.**

## Slice 5 — Announcements

User said "go-ahead" — approval to start the next item in the proposed
sequencing.

### Design

**No new entity needed beyond one small table** — course-level
announcements didn't exist anywhere in the ERP. `Announcement`
(`teachingAssignmentId`, `title`, `body`, `isPublished`) is anchored to
`TeachingAssignment`, same "Course" precedent as every other piece of
teacher content this LMS work has added, with the same draft/publish
gate as `CourseModule`/`Assignment`/`KnowledgeCheck` — a draft is
invisible to students until the owning teacher explicitly publishes
it. Deliberately minimal: no per-student read-tracking and no replies
— read receipts weren't asked for, and replies are a discussions
concept (a later, separate slice), not this one's scope.

**No separate admin service to reuse, no new module** — same shape as
course modules (slice 2): this is purely teacher-owned course content
with no existing admin CRUD surface and no generic staff permission
that would fit it, so both reads and writes are direct `tx` queries
added straight into `teacher-portal.service.ts`/`student-portal.
service.ts`, not delegated through a shared service the way
assignments/quizzes reuse `AssignmentsService`/`KnowledgeChecksService`.

- `teacher-portal` (new methods): `listAnnouncements`/
  `createAnnouncement`/`updateAnnouncement` — ownership-checked against
  `announcement.teachingAssignment.employeeId` before any read or
  write, 404 on a different teacher's course.
- `student-portal` (new method): `listAnnouncements` — published
  announcements across every `TeachingAssignment` matching the
  student's own active enrollment (section+term), same "enrolled is
  derived structurally, never trusted from a param" shape as courses/
  assignments/quizzes. No single-announcement GET endpoint exists (not
  needed — the list already carries the full body, same as a real
  announcement feed), so there's nothing for an unenrolled student to
  probe by id; their own list is simply empty.

**Web**: `/teacher` gains a "My courses — announcements" card (course
picker → list with a publish toggle and the full body shown inline →
a create form: title + a plain Tailwind-styled `<textarea>` for the
body, same "no shadcn Textarea component exists, don't introduce one
for a single use" precedent as the assignment submission page).
`/portal/announcements` (new nav link) is a simple reverse-chronological
feed — title, course + instructor, date, full body — deliberately no
detail page, since a list item already shows everything there is to
show.

### Verified

- `pnpm -r typecheck`/`lint`/`build` clean across all six packages
  (the same pre-existing, unrelated `apps/web/src/app/sso/page.tsx`
  lint failure from slice 4 is still there, still out of scope).
- `services/api` e2e: one new comprehensive test (`-t "Announcements"`)
  — a different teacher can't post or publish an announcement on
  someone else's course (404, IDOR guard); a draft is invisible to an
  enrolled student (empty list); publishing makes it visible with the
  correct course/instructor info; a student not enrolled in that
  course never sees it, published or not (empty list); the owning
  teacher's own list shows both draft and published announcements on
  their course, while a different teacher can't even list them (404);
  cross-tenant posting on org A's course from org B is rejected (404).
  Passed clean (`28688 ms`) on the first run — no bugs found in this
  slice's own application code.
- Full browser pass in the Everest Academy demo org: as the real
  teacher (Sunita Karki), posted "No class Friday" (Mathematics) as a
  draft, then published it — confirmed 201/200 via network responses;
  as the real student (Aarav Sharma), confirmed `/portal/announcements`
  shows it with the correct title, course, instructor, date, and full
  body text. **Per the same standing instruction as slices 1–4, this
  demo data (the announcement) was left in place, not cleaned up.**

## Slice 6 — Discussions

User said "go-ahead" — approval to start the next item in the proposed
sequencing.

### Design

**Two small tables, both anchored the same way as everything else in
this LMS work**: `DiscussionTopic` (`teachingAssignmentId`, `title`,
`body`, `isPublished` — same draft/publish gate as `Announcement`) and
`DiscussionPost` (`discussionTopicId`, `body`, plus `authorStudentId`/
`authorEmployeeId`). Flat replies only, deliberately — nested/threaded
replies weren't asked for, same "don't build unrequested flexibility"
precedent as `Stop`-per-`Route` in Transport.

**The author is exactly one of a Student or an Employee** — both the
owning teacher and any enrolled student can reply to the same topic,
so a post needs to record which kind of identity wrote it. Modeled as
two typed nullable FKs rather than an untyped `personId`+`personType`
pair, mirroring `FaceEnrollment.studentId`/`staffId` exactly (real FK
integrity, XOR enforced at the service layer by construction — the
service methods take a `{ studentId }` or `{ employeeId }` author
object, never both).

**One new controller-less module** (`discussions`, service only,
exported — same shape as `AiGatewayModule`): unlike course modules/
announcements (teacher-owned content, no existing service to reuse,
so those went straight into `teacher-portal.service.ts`), a discussion
topic's reply logic is *symmetric* — both portals need identical
topic/post CRUD, just with a different linked author. Rather than
duplicating "load topic with posts, ordered" and the create-post shape
in both `teacher-portal` and `student-portal`, that shared logic lives
in `DiscussionsService`, injected into both. Each portal still does
its own ownership/enrollment check **before** calling in — exactly the
same "reuse the existing service, add a self-service check in front"
precedent as `AssignmentsService`/`KnowledgeChecksService`, just with
a service built for this slice instead of one that already existed.

- `teacher-portal` (new methods): `listDiscussionTopics`/
  `createDiscussionTopic`/`updateDiscussionTopic` (including publish)/
  `getDiscussionTopic`/`createDiscussionPost` — ownership-checked
  against `topic.teachingAssignment.employeeId`, 404 on a different
  teacher's course.
- `student-portal` (new methods): `listDiscussionTopics` (a **flat,
  cross-course feed** — same shape as `listAnnouncements`/
  `listAssignments`/`listQuizzes`, not a per-course pick-a-course-first
  list like the teacher-portal side, which is already organized around
  an explicit course picker) / `getDiscussionTopic`/
  `createDiscussionPost` — gated to a *published* topic on a course
  the student is actively enrolled in.

**Web**: `/teacher` gains a "My courses — discussions" card (course
picker → topic list with a publish toggle → expand a topic to see its
body, every reply with the author's name, and a reply form → a
start-topic form). `/portal/discussions` (new nav link) is a flat feed
across enrolled courses; `/portal/discussions/[topicId]` shows the
topic body, every reply (teacher replies labeled "(Teacher)"), and a
reply form — structurally the closest of any page yet to a real
mini-forum thread, but still flat, no reply-to-reply nesting.

### Verified

- `pnpm -r typecheck`/`lint`/`build` clean across all six packages
  (the same pre-existing, unrelated `apps/web/src/app/sso/page.tsx`
  lint failure is still there, still out of scope).
- `services/api` e2e: one new comprehensive test (`-t "Discussions"`)
  — a different teacher can't start, read, update, or reply to a topic
  on someone else's course (404, IDOR guard); a draft topic is
  invisible to an enrolled student and can't be replied to (404);
  publishing makes it visible; a student not enrolled in that course
  never sees it and can't reply (404); an enrolled student's reply is
  attributed to their own Student row; the owning teacher's reply is
  attributed to their own Employee row; both the teacher's and the
  student's own topic views show both replies in order with the
  correct author populated; cross-tenant topic creation on org A's
  course from org B is rejected (404). Passed clean (`43476 ms`) on
  the first run — no bugs found in this slice's own application code.
- Full browser pass in the Everest Academy demo org, which also
  surfaced (and self-resolved) a real environmental hiccup: as the
  real teacher (Sunita Karki), started "Favorite math trick?"
  (Mathematics) as a draft, published it, and replied to it — the
  first attempts at three different requests each hit a transient Neon
  connection-pool error (`P2028: Unable to start a transaction in the
  given time`), including on `listAssignments`/`listAnnouncements`/
  `listQuizzes` (pre-existing, already-shipped endpoints) at the exact
  same moment, which confirmed it was an ambient database blip, not a
  bug in this slice's code — a plain retry succeeded immediately each
  time, and a process check found no stray leftover server (the
  project's own established diagnostic protocol for this error class).
  As the real student (Aarav Sharma), confirmed `/portal/discussions`
  lists the topic with the right course/instructor, opened it, and
  confirmed both the teacher's reply (labeled "(Teacher)") and then
  the student's own new reply render in the correct order with the
  correct author names — confirmed via both the UI and the underlying
  network responses. **Per the same standing instruction as slices
  1–5, this demo data (the topic and both replies) was left in place,
  not cleaned up.**

## Slice 7 — Gradebook

User said "go-ahead" — approval to start the next item in the proposed
sequencing.

### Design

**No new grade data of any kind.** This slice closes the exact gap the
discovery pass flagged — *"Marks/Grade vs. AssignmentSubmission.score
are two disconnected grading shapes"* — not by inventing a third
shape, but by giving each side a single roster-shaped view over data
that already exists: `AssignmentSubmission.score` (slice 3) and
`KnowledgeCheckAttempt.score` (slice 4), reusing `listTeacherAssignments`/
`listTeacherQuizzes`/`listStudentAssignments`/`listStudentQuizzes`
wholesale. **Exam `Marks`/`Grade` are deliberately excluded** — that's
a separate domain scoped to `ExamSubject`/`CurriculumSubject` rather
than `TeachingAssignment`, with its own admin-facing grading/report-
card module already built (Phase 4); folding it into a
`TeachingAssignment`-scoped gradebook would need a real
`CurriculumSubject`↔`Subject`↔`TeachingAssignment` bridge that wasn't
asked for and isn't attempted here.

**Exactly one new backend endpoint**: `GET teacher-portal/courses/
:teachingAssignmentId/roster` — the full list of actively-enrolled
students for that course (same `sectionId`+`termId` derivation as
`listCourses`/`listAssignments`/`listQuizzes`), ownership-checked
against the caller's own `TeachingAssignment`. Everything else is
composed **client-side**: the teacher's gradebook grid is built in the
browser from three parallel fetches (roster + the already-existing
assignments-with-submissions + quizzes-with-attempts), and the
student's grades page is two of their own already-existing list calls
rendered on one page instead of two separate nav destinations.

**Web**: `/teacher` gains a "Gradebook" card (course picker → a
spreadsheet-style table: one row per enrolled student, one column per
*published* assignment/quiz, each cell showing a graded score, "Submitted"/
"In progress" for an ungraded-but-attempted item, or "—" for nothing
yet — draft assignments/quizzes are excluded from the columns entirely,
matching the same "students never see draft content" rule this data
already enforces on the student side). `/portal/grades` (new nav link)
is a two-section page — Assignments, Quizzes — each row reusing the
exact same status-badge convention as `/portal/assignments`/
`/portal/quizzes` individually.

### Verified

- `pnpm -r typecheck`/`lint`/`build` clean across all six packages
  (the same pre-existing, unrelated `apps/web/src/app/sso/page.tsx`
  lint failure is still there, still out of scope).
- `services/api` e2e: one new, deliberately narrow test (`-t
  "Gradebook"`) — since the grade grid itself is just a client-side
  recombination of data slices 3 and 4 already cover end-to-end, this
  test only needs to prove the one new roster endpoint's own guards:
  a different teacher can't read another teacher's course roster
  (404, IDOR guard); the roster returns exactly the students actively
  enrolled in that course's section+term, correctly excluding an
  unrelated student who was created but never enrolled; cross-tenant
  access from org B is rejected (404). Passed clean (`16952 ms`) on
  the first run — no bugs found.
- Full browser pass in the Everest Academy demo org: as the real
  teacher (Sunita Karki), selected Mathematics in the new Gradebook
  card and confirmed the grid shows Aarav Sharma's row with the exact
  scores already on record from slices 3 and 4 ("9 / 10" for Counting
  Practice Worksheet, "50%" for Addition Basics Quiz) — confirmed via
  the rendered page text; as the real student (Aarav Sharma), confirmed
  `/portal/grades` shows both scores on one consolidated page with the
  correct course label and status-colored badges — confirmed via both
  the rendered page text and a screenshot. No new demo data was created
  this slice (the endpoint is read-only over slices 3/4's existing
  data), so there was nothing new to leave in place or clean up.

## Slice 9 — Notifications

User said "go-ahead" — approval to start the next item in the proposed
sequencing (file upload, #8, stays blocked on the still-open storage
decision, so this skips ahead to it).

### Design

**Closes the exact gap discovery flagged**: *"persistent notifications
— only ephemeral client-side toasts exist."* A toast fires once, in
the tab that triggered it, and is gone forever if the recipient wasn't
looking at that moment or wasn't even the one who took the action.
This slice adds one small, real, persisted `Notification` row per
event per recipient.

**Keyed by `User.id`, not `Student`/`Employee`** — a notification is
"for whoever is logged into this account," independent of role, which
matches how the JWT's own identity already resolves and lets **one
shared, role-agnostic controller** (`NotificationsController`, under
`organizations/me/notifications`) serve every role alike — the first
truly-shared self-service surface in this LMS work, rather than a
teacher-portal/student-portal split. A student/employee with no portal
login simply can't receive one, same "no linked User, no self-service
feature" rule as everywhere else in this project. **No real-time
delivery** — no websocket/push infrastructure exists anywhere in this
project (same standing precedent as Transport's own tracking polling),
so the client polls.

**`type` is a free-text field, not an enum** — same "the plan forbids
hard-coded institution-specific vocabularies" reasoning already applied
to `Vehicle.type`/`Student.gender` elsewhere: a new notification-worthy
event later shouldn't need a schema migration to add a variant.

**New `NotificationsService`** (controller-less write side has no
self-service guard of its own — see its own top-of-file comment for
why that's correct here, unlike every other reused service in this
project): `notify` (one recipient), `notifyEnrolledStudents` (fans out
to every actively-enrolled, logged-in student in one course, gathering
the roster the same way `getCourseRoster`/`listAssignments`/
`listQuizzes` already do), plus the self-service `listMine`/
`markRead`/`markAllRead` behind the shared controller.

**Six trigger points wired into already-existing actions — no new
content types, no new admin surface**:
- `teacher-portal.updateAssignment`/`updateAnnouncement`/
  `updateDiscussionTopic`: each of these three already combines general
  editing and publishing into one call, so the trigger fires only on
  the real **draft→published transition** (before/after `isPublished`
  compared), not on every edit.
- `teacher-portal.publishQuiz`: a dedicated action whose own guard
  already 400s on a repeat call, so every successful call here is
  unconditionally a real publish — no before/after diff needed.
- `teacher-portal.gradeSubmission`: notifies only the specific graded
  student (looked up by `Assignment.teachingAssignment` → the
  submission's own `studentId` → that student's `userId`), never every
  enrolled student.
- `DiscussionsService.createPost`: notifies everyone already in the
  conversation — the topic's owning teacher plus every distinct prior
  poster — except whoever just posted. Lives inside `DiscussionsService`
  itself (not duplicated in both portals) since it already owns the
  topic+posts data slice 6 built.

Each of `updateAnnouncement` was restructured from one nested
`withTenant` call into two independent top-level calls (ownership
check, then mutation) so a publish-triggered `notifyEnrolledStudents`
call — which needs its own `withTenant` — can run afterward without
nesting (Prisma doesn't support nested `$transaction` calls, the same
constraint every prior slice's service-to-service calls already work
around).

**Web**: a single shared `NotificationBell` component (bell icon,
unread-count badge, a small dropdown panel — plain state-driven, not
the shadcn `DropdownMenu` primitive, since a notification list's
click-to-navigate-and-mark-read behavior doesn't fit that primitive's
menu-item semantics any more naturally, and this project's own
precedent is "don't reach for a bigger abstraction than the one use
needs") is dropped into both `/teacher`'s and `/portal`'s headers —
polling every 30s, "Mark all read," and clicking a notification marks
it read and navigates to its `link`.

### Verified

- `pnpm -r typecheck`/`lint`/`build` clean across all six packages
  (the same pre-existing, unrelated `apps/web/src/app/sso/page.tsx`
  lint failure is still there, still out of scope).
- `services/api` e2e: one new, deliberately comprehensive test (`-t
  "Notifications"`) covering all six trigger points and the read-side
  guards in one fixture — publishing an assignment/quiz/announcement/
  discussion topic each notifies both enrolled students and never the
  unenrolled outsider; grading notifies only the graded student, not
  the other enrolled one; a student's discussion reply notifies the
  topic-owning teacher but never the student's own account; the
  teacher's reply back notifies that student but never the teacher's
  own account; a different student can't mark someone else's
  notification read (404, IDOR guard); mark-one and mark-all-read both
  work; org B's own notification list never includes any of org A's
  (cross-tenant). Passed clean (`64453 ms`) on the first run — no bugs
  found in this slice's own application code.
- Full browser pass in the Everest Academy demo org: as the real
  teacher (Sunita Karki), posted and published a real announcement
  ("Live notification test") — confirmed 201/200 via network
  responses; as the real student (Aarav Sharma), confirmed the bell
  showed a red unread-count badge, opened the dropdown and confirmed it
  rendered the notification's title and timestamp in bold (unread),
  clicked it, and confirmed both that it navigated to `/portal/
  announcements` (which correctly lists both the new and prior
  announcements) and that the bell's badge disappeared — proving the
  click-through mark-as-read worked end to end, not just via direct API
  calls. **Per the same standing instruction as every prior slice, this
  demo data (the announcement and the notification it generated) was
  left in place, not cleaned up.**

## Next step

Teacher portal (slice 1), course modules (slice 2), self-service
assignments (slice 3), the quiz engine (slice 4), announcements
(slice 5), discussions (slice 6), the gradebook (slice 7), and
notifications (slice 9) are done. The only remaining proposed item is
**file upload (slice 8)**, still blocked on the same still-open
architectural decision flagged since Phase 1 (no object storage exists
anywhere in this project) — starting it for real needs that decision
made first, not just another go-ahead.
