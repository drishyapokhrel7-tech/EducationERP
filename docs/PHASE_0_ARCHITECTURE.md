# Phase 0 — Repository Assessment & Architecture Baseline

Source plan: [`CLAUDE_CODE_DEVELOPMENT_PLAN.docx`](./CLAUDE_CODE_DEVELOPMENT_PLAN.docx)
Status: **draft — awaiting approval before Phase 1 implementation begins**

---

## 1. Repository Assessment

`~/educationERP` is currently empty — no code, no git history, no prior
architecture decisions to preserve or refactor around. This is a **greenfield
build**. Nothing in this section constrains later phases; it exists only to
record the starting state per the plan's Phase 0 protocol (inspect before
building).

Nothing to migrate, no technical debt, no reusable code identified.

---

## 2. Target Architecture

Confirmed stack (per plan §2), unchanged:

| Layer | Technology | Notes |
|---|---|---|
| Web portals | Next.js, React, TypeScript, Tailwind, shadcn/ui | Student/Parent/Teacher/Management/Admin/Alumni — browser only |
| Desktop clients | Electron, React, TypeScript, Vite, secure IPC | Institutional/hardware/offline use only — never a substitute for a web portal |
| Backend API | NestJS + TypeScript | REST + WebSockets |
| Database | PostgreSQL + pgvector | One schema-per-tenant-key strategy, see §5 |
| Cache/Queue | Redis + BullMQ | Jobs, sync, AI/document/CCTV processing |
| AI service | Python + FastAPI | Gateway/router in front of Hugging Face runtime |
| AI models | Hugging Face Transformers, PyTorch, sentence-transformers, ONNX Runtime, OpenCV | Local-first, no paid API required |
| Storage | Local disk + S3-compatible abstraction | Swappable backend behind one interface |
| DevOps | Docker Compose (dev), CI/CD, monitoring, backups | |

Web vs. Electron rule (plan §2.1) is treated as a hard constraint, not a
suggestion: Electron only ships for Institution Admin, Teacher Desktop, Secure
Exam, CCTV/Attendance, and Biometric/Device Gateway clients — everything else
(Student, Parent, Management, Alumni, general Admin browsing) is Next.js in a
standard browser.

---

## 3. Proposed Monorepo Structure

```
educationERP/
├── apps/
│   ├── web/                  # Next.js — all browser portals, route-grouped by role
│   ├── admin-desktop/        # Electron — institution admin client
│   ├── teacher-desktop/      # Electron — teacher client
│   ├── exam-client/          # Electron — secure/offline exam environment
│   └── cctv-client/          # Electron — camera/biometric gateway
├── services/
│   ├── api/                  # NestJS — REST/WS backend
│   └── ai/                   # Python/FastAPI — AI gateway + model router
├── packages/
│   ├── ui/                   # shared shadcn/ui component library
│   ├── types/                # shared TS types/DTOs (generated from API where possible)
│   ├── api-client/           # typed fetch/query client used by web + electron
│   ├── validation/           # shared zod/class-validator schemas
│   ├── auth/                 # shared auth/session/permission helpers
│   └── config/               # shared env/config loading
├── infra/
│   ├── docker/                # Dockerfiles per service
│   ├── docker-compose.yml     # local dev stack: postgres, redis, api, ai, web
│   └── migrations/            # if not colocated with services/api
├── docs/
│   ├── CLAUDE_CODE_DEVELOPMENT_PLAN.docx
│   ├── PHASE_0_ARCHITECTURE.md
│   └── adr/                   # architecture decision records, one per major call
└── turbo.json / pnpm-workspace.yaml
```

Turborepo + pnpm workspaces is the natural fit for this shape (fast
incremental builds across many TS packages, native support for
Next.js/NestJS/Vite). No decision has been made on this yet — flagged as an
open item in §11.

---

## 4. Module Dependency Map

```
config ──► auth ──► api-client ──► web
  │          │           │          │
  │          │           └────► admin-desktop / teacher-desktop / exam-client / cctv-client
  │          │
  │          └────► services/api (NestJS) ──► PostgreSQL, Redis
  │                        │
  │                        ├──► services/ai (FastAPI) ──► Hugging Face runtime
  │                        └──► cctv pipeline (OpenCV/embeddings) ──► pgvector
  │
  └────► validation, types, ui  (leaf packages, no internal deps)
```

Rules encoded by this map:
- `services/api` is the only writer of transactional data; `services/ai`
  never touches PostgreSQL directly for anything except pgvector
  read/write through a scoped, permission-checked interface — it cannot run
  arbitrary SQL (plan §2.3, §9).
- Electron apps talk to `services/api` the same way `web` does, through
  `packages/api-client`, over the network when online. Local/offline data
  lives behind a separate encrypted local store + sync engine, not a second
  copy of business logic.
- `packages/ui` has zero business logic — pure presentation, usable by both
  Next.js and Electron's renderer.

---

## 5. Multi-Tenancy & RBAC Design

**Hierarchy** (plan §4): `Organization → Institution → Campus →
Faculty/School → Department → Program → Academic Year → Semester/Term →
Class/Section`.

**Isolation strategy** (to be finalized as an ADR, leaning toward this by
default):
- Single PostgreSQL database, `organization_id` (tenant key) as a mandatory
  column on every tenant-owned table, enforced via Postgres Row-Level
  Security policies **in addition to** application-level scoping — belt and
  suspenders, since app-level-only scoping is the most common source of
  cross-tenant leaks.
- Every NestJS request carries a resolved tenant context (from session/JWT,
  never from a client-supplied header/body field) attached by a guard before
  any handler runs; repositories/services accept that context explicitly
  rather than reading it from ambient state, so a missing-scope bug fails
  loudly instead of silently returning unscoped data.
- Cross-tenant access tests (direct ID access, filtered/indirect access,
  IDOR) are written alongside each module's tests, not deferred to a final
  audit pass — matches plan §4 and §7's explicit test requirement.

**RBAC**: role table seeded with the seventeen roles in plan §7
(Super Admin down to Student/Parent), permissions modeled as
`(resource, action)` pairs — action set: view, create, update, delete,
approve, export, print, manage, administer — joined through
`role_permissions`. Authorization is enforced in NestJS guards/interceptors
server-side; the UI hides controls the user can't use but never relies on
that as the actual boundary.

---

## 6. Core ERD Proposal (entity groups)

Full column-level ERD is a Phase 1 deliverable (needs an actual modeling
pass); Phase 0 fixes the entity groups and their relationships at a coarse
grain, per plan §6:

- **Organization**: `organizations → campuses → faculties → departments →
  programs → academic_years → semesters/terms → sections`
- **Student**: `students` at the center, fanning out to `student_profiles`,
  `student_addresses`, `student_guardians` (+ `guardian_relationships`),
  `student_documents`, `student_enrollments`, `student_programs`,
  `student_sections`, `student_status_history`, `student_photos`,
  `student_identifiers`
- **Staff**: `employees` center, `staff_types`, `departments`,
  `designations`, `teacher_profiles` (+ `teacher_subjects`),
  `employment_history`, `qualifications`, `staff_documents`
- **Academic**: `subjects`, `courses`, `course_sections`, `curriculum` (+
  `curriculum_subjects`), `teaching_assignments`, `class_schedules`,
  `rooms`, `periods`
- **Teaching & Learning**: the deepest hierarchy in the system —
  `syllabi → syllabus_versions → syllabus_units → syllabus_chapters →
  topics → subtopics → learning_objectives`, plus `lesson_plans`,
  `class_sessions`, `class_materials`, `syllabus_progress`, `assignments` (+
  `assignment_submissions`), `rubrics` (+ `rubric_items`),
  `knowledge_checks`, `assessment_attempts` (+ `assessment_answers`),
  `learning_events`, `learning_analytics`. See §7 below — this group drives
  the central workflow and deserves first-class modeling attention.
- **Attendance**: `attendance_sessions`, `student_attendance`,
  `staff_attendance`, `attendance_devices`, `attendance_events`,
  `entry_exit_records`, `attendance_exceptions`
- **Examination**: `exams` (+ `exam_types`, `exam_schedules`,
  `exam_subjects`, `exam_rooms`), `questions` (+ `question_banks`,
  `question_options`), `exam_attempts` (+ `answers`), `marks`, `grades` (+
  `grading_schemes`), `report_cards`
- **Finance**: `fee_structures`/`fee_categories`, `student_fee_assignments`,
  `invoices` (+ `invoice_items`), `payments` (+ `payment_methods`),
  `scholarships`, `discounts`, `refunds`, `financial_transactions`
- **Library / Transport / Hostel / Inventory / HR-Payroll / Communication**:
  as enumerated in plan §6, each a self-contained group hanging off Student
  or Staff — deferred to their respective phases (5, 7) for detailed
  modeling.
- **Security**: `users`, `roles`, `permissions`, `role_permissions`,
  `sessions`, `login_events`, `audit_logs`, `access_policies`
- **AI**: `ai_models`, `ai_providers`, `ai_requests`, `ai_outputs`,
  `ai_audit_events`, `embeddings`, `rag_documents`, `rag_chunks`
- **CCTV/Biometric**: `cameras` (+ `camera_adapters`), `camera_events`,
  `face_enrollments`, `face_embeddings`, `face_match_events`,
  `biometric_policies`, `biometric_retention_rules`
- **Alumni & Career**: `alumni_profiles` through `graduate_outcomes` as
  listed in plan §6 — entirely deferred to Phase 8.

Every tenant-owned table above carries `organization_id`, standard audit
columns (`created_at`, `updated_at`, `created_by`, `updated_by`), and soft
deletion (`deleted_at`) where records need recoverability (student records,
financial transactions) rather than hard deletes.

---

## 7. Teaching & Learning Data Model (central workflow)

This is called out separately because plan §8 treats it as the platform's
spine, not just another module:

```
Syllabus → Lesson Plan → Class Schedule → Teaching → Class Material →
Post-Class Objective Assessment → Assignment → Submission → AI Analytics →
Teacher Feedback → Student Progress
```

Design implications for Phase 3 modeling:
- The syllabus hierarchy (academic year → faculty → program → grade/class →
  subject → semester/term → unit → chapter → topic → subtopic → learning
  objective → expected outcome) needs to be traversable in both directions:
  "what should this class have covered by now" (planned) vs. "what did it
  actually cover" (`syllabus_progress`, tracking planned vs. actual dates and
  hours) — these must be separate rows, not one row mutated in place, so
  variance is queryable for analytics.
- `class_sessions` is the join point: it references a `class_schedule` slot,
  the `topic` actually taught, attendance taken for that session, and the
  materials/knowledge-check/assignment created during class completion. The
  "My Classes Today" teacher view (plan §8) is a read model over exactly
  these tables, not a separate data source.
- `knowledge_checks` and `assessment_attempts` are intentionally distinct
  from full `exams` — short, low-stakes, teacher-published — but they feed
  the same `learning_analytics` aggregation as exam results and assignment
  grades, so a student's progress signal is one connected chain, per plan's
  final acceptance criteria.

---

## 8. Electron Client Architecture

Per plan §2.2/§12, every Electron client shares one hardened shell:

- `contextIsolation: true`, `nodeIntegration: false`, sandboxing on by
  default.
- A single shared `preload` package (in `packages/`) exposing a narrow,
  explicitly-allowlisted IPC surface — renderer code never gets raw Node
  access, and new IPC channels require a deliberate addition to the
  allowlist, not an opt-out.
- Hardware integrations (biometric/RFID/barcode/printer/camera) go through
  an adapter interface so no client hard-codes a vendor SDK directly —
  adapters are swappable per plan §12's explicit requirement.
- Offline data: encrypted local store (e.g. SQLCipher or OS keychain-backed
  encryption) + a sync/retry queue, reconciled against `services/api` when
  connectivity returns. Electron clients never contain a parallel copy of
  business rules — they queue intents, the server is still the source of
  truth for anything that touches shared/tenant data.
- Auto-update: signed builds, controlled rollout — mechanism (e.g.
  electron-updater against a private feed) to be finalized as an ADR before
  Phase 6/7 client work.

---

## 9. Hugging Face / Local-First AI Architecture

```
ERP (NestJS) → AI Gateway (authenticated internal API) → Model Router →
HuggingFaceLocalProvider → CPU/GPU
```

- `services/ai` (FastAPI) owns model loading/caching, CPU/GPU detection, and
  quantization; NestJS never talks to a model directly.
- Provider abstraction from day one: `HuggingFaceLocalProvider` is the
  default and only required provider; any paid provider (OpenAI/Anthropic/
  etc.) is an optional adapter behind the same interface, never a hard
  dependency (plan §2.3, confirmed again in Final Acceptance Criteria).
  Model IDs are config, not code — never hard-coded per plan's explicit
  instruction.
- RAG pipeline: document → chunk → embed → `pgvector` → **permission-aware**
  retrieval (tenant/institution/campus/role/user filters applied at the
  retrieval query, not post-filtered after the fact) → generation. The LLM
  is never given raw SQL execution capability.
- Every AI action logs to `ai_audit_events`; subjective grading and
  generated academic content are draft-only until a teacher/admin approves
  — enforced at the data layer (an `ai_outputs.approved_by`/`approved_at`
  pair gates anything from reaching a student-visible/official record), not
  just a UI convention.
- Multilingual (English/Nepali) support and specific model choices are
  deferred to Phase 5 — flagged as an open item in §11, since model
  selection needs actual quality/license validation, not a guess now.

---

## 10. CCTV / Biometric Architecture

```
Camera/RTSP → Camera Adapter → Frame Processing (OpenCV) → Person Detection
→ Face Detection → Quality/Liveness Check → Face Embedding → Secure Vector
Matching (pgvector) → Identity Candidate → Confidence Threshold →
Attendance Event → ERP
```

Non-negotiable constraints carried forward from plan §11 into the design:
- Entirely optional per institution — a disable switch is a first-class
  config, not an afterthought.
- Three-way match result, never binary: identified / possible match /
  unknown — UI and data model must represent all three, with human review
  required for "possible match."
- Biometric embeddings encrypted at rest, access-controlled and audited
  separately from general student data (`biometric_policies`,
  `biometric_retention_rules` govern retention, not a global default).
- Explicitly out of scope, permanently: emotion recognition,
  sensitive-attribute inference, surveillance-style profiling. This is a
  hard boundary, not a "not in this phase" note.
- Manual attendance entry remains available as a fallback at all times —
  the CCTV pipeline augments, never replaces, the attendance system.

Deferred to Phase 6 in full; Phase 0 only fixes the shape above.

---

## 11. Phased Implementation Plan

Adopting plan §20 as-is (Phase 0 → Phase 8 → Final Audit). No changes
proposed — the sequencing (Foundation → Student/Academic core →
Teaching/Attendance → Examination → AI → CCTV → Business Ops → Analytics/
Alumni/Production) already puts the platform's core value (SIS + LMS +
Exams) ahead of the heavier optional systems (CCTV, full HR/payroll),
which matches how these platforms actually get adopted by institutions.

Phase 1 (Foundation), when approved, starts with: monorepo scaffold (§3),
Postgres + migrations baseline, Redis/BullMQ wiring, auth (sessions +
RBAC skeleton from §5), multi-tenancy enforcement (RLS + guard), design
system bootstrap, and an admin dashboard shell — deliberately no domain
features yet, so every later phase builds on a tested foundation.

---

## 12. Risks & Unresolved Decisions

These need an explicit answer (yours, or a proposed default I'll flag as an
ADR) before or during Phase 1 — not blocking this Phase 0 writeup, but
listed so nothing gets silently decided:

1. **Monorepo tooling** — Turborepo + pnpm assumed above; not yet decided.
2. **Tenant isolation mechanism** — RLS + app-level scoping proposed in §5;
   alternative is schema-per-tenant, which trades simpler isolation
   guarantees for harder cross-tenant reporting and migrations. Proposed
   default: RLS + app scoping.
3. **Initial Hugging Face model selection** — plan defers this
   deliberately (§10, §2.3: "must not hard-code... model IDs"); Phase 5
   needs a concrete shortlist per AI feature (lesson planning, question
   generation, grading assist, embeddings, OCR, translation) with license
   review.
4. **Nepali language + calendar support depth** — plan §14 says
   "optional... do not hard-code Nepal-specific assumptions into core
   architecture," which implies a localization/config layer rather than
   Nepal-specific tables. Needs confirmation this reading is correct.
5. **Object storage backend for local dev vs. production** — plan says
   "local storage + S3-compatible abstraction"; needs a concrete choice
   for local dev (e.g. MinIO in docker-compose) vs. actual target (S3,
   R2, or on-prem) for production.
6. **Electron auto-update feed / code-signing identity** — needs real
   certificates/infrastructure before Phase 6/7 client builds are usable
   outside dev machines; not a blocker for Phase 1-5 backend/web work.
7. **Deployment target** — plan lists Docker/Docker Compose/CI-CD but not
   a specific hosting environment (on-prem institution servers vs. cloud
   VPS vs. managed Postgres). Affects the S3-compatible storage decision
   above and the "on-premise by default" AI/CCTV requirement.
8. **Demo/seed data** — plan §19 asks for realistic demo data without real
   personal information; will be generated per-module as each phase lands
   rather than all upfront.

None of these block Phase 1 foundation work; they're flagged here so
they're visible rather than defaulted-into silently later.

---

## 13. Next Step

Per the plan's own execution protocol (§21, step 17: "STOP. Do not start
the next phase until instructed"), this document is the full Phase 0
deliverable. Implementation does not begin until you review this and give
the go-ahead for **Phase 1 — Foundation**.
