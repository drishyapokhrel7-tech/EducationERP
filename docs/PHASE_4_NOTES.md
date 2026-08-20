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

## Next step

Slice 4a done, stopped per plan §21 step 17. Next up per the slice
breakdown in this file's intro: **4b — Exams & scheduling** (`Exam`
plus subjects/rooms/dates), binding 4a's question banks and grading
schemes to a real exam sitting for a term. Not yet approved by the
user — wait for explicit go-ahead before starting.
