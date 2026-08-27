# Phase 8 — Analytics, Alumni, Reporting & Production

Companion to [`PHASE_0_ARCHITECTURE.md`](./PHASE_0_ARCHITECTURE.md) and
every prior phase's notes. Phase 8 (plan's remaining scope after Phase
7 closed) covers "advanced analytics, alumni/career, graduate outcomes,
reports, notifications, global search, performance optimization,
security hardening, backups, observability, deployment and release
management" — the plan's final layer, built entirely on top of the now-
complete academic core (Phases 1-4), biometric pipeline (Phase 6), and
business-operations layer (Phase 7).

User said "go-ahead" after Phase 7 fully closed (all four "complete
all"-authorized domains — Hostel, Inventory, Communication, Documents &
Certificates — shipped and committed). Alumni & Career has its own
full 14-table ERD in the plan (docx): `alumni_profiles,
alumni_education, alumni_career_history, alumni_companies,
alumni_skills, alumni_certifications, alumni_surveys,
alumni_survey_responses, alumni_mentorship, career_opportunities,
career_applications, alumni_achievements, career_services,
graduate_outcomes`. Sliced the same way every prior multi-table domain
has been:

- **8a** (this slice) — Alumni & Career core: profile, education,
  career history, companies, skills, certifications.
- **8b** (not started) — Alumni engagement: surveys, mentorship,
  achievements.
- **8c** (not started) — Career services: opportunities, applications,
  services, graduate outcomes.
- **8d** (not started) — Analytics & Reports, cross-cutting over all of
  the above plus every prior phase.

Each slice needs its own explicit go-ahead when reached, same as every
other phase's slices. This document gets a new section per slice, same
convention as `PHASE_2_NOTES.md` through `PHASE_7_NOTES.md`.

## Slice 8a — Alumni & Career, part 1 (profile, education, career, companies, skills, certifications)

An alumnus is a graduated `Student` (`StudentStatus.GRADUATED` already
existed from Phase 2, set via the pre-existing `PUT students/:id/
status`), converted into an `AlumniProfile` by an **explicit admin
action**, not an automatic side effect of the status change — same
"deliberate action, not a side effect" precedent as `computeGrade`/
`generateReportCard` in Phase 4.

**No new alumni auth system.** An alumnus reuses their existing
student-portal login (`Student.userId`) — the self-service methods on
`StudentPortalService` derive `studentId` server-side from the JWT the
exact same way `getOwnDocuments`/`getOwnCertificates` already do,
never a request param (IDOR-safe by construction).

**`AlumniCompany` is a real catalog** (upsert-by-name, mirrors the
`HostelLookup` standardization pattern from 7e), mainly for future
aggregate-reporting grouping. **`AlumniSkill` deliberately stays flat
free text**, no catalog — skills are too varied and there's no concrete
reporting need yet for exact-name grouping, unlike room types or
visitor relations.

**`AlumniCareerHistory` keeps real history** (multiple rows per
alumnus, `endDate` nullable = current role) — a stack of past and
current jobs, not a single "current pointer" like
`HostelAllocation`/`StudentTransportAssignment`. Only `endDate` is
editable once a career-history row exists ("immutable once created"
for the rest of the row, same precedent as payroll's snapshotted
items).

### Schema

New section in `schema.prisma`, all six tables RLS-protected normally
(no RLS-exemption needed here — Alumni has no public-facing endpoint,
unlike `Certificate` in 7h):

- `AlumniProfile` — `studentId` unique FK, `graduationYear`,
  `currentOccupation`/`currentEmployer`/`currentLocation`/`bio`/
  `linkedinUrl` (all optional, self-updatable), `isPubliclyVisible`
  (reserved for a future public alumni directory, not built this
  slice).
- `AlumniEducation` — post-graduation education records.
- `AlumniCompany` — org-scoped catalog, `@@unique([organizationId,
  name])`.
- `AlumniCareerHistory` — `companyId` FK, `jobTitle`, `startDate`,
  nullable `endDate`, `description`.
- `AlumniSkill` / `AlumniCertification` — flat per-profile records.

Two migrations: `20260827105244_alumni_career_part1` +
`20260827105412_alumni_career_part1_rls`.

### Backend

New `alumni` module (`services/api/src/modules/alumni/`): admin CRUD
for all six tables under `organizations/me/alumni-*`, RBAC resource
`alumni` (folds profile/education/career_history/company/skill/
certification in, same "closely-related concepts share a resource"
precedent used throughout Phase 7), Super Admin/Organization Admin
only. `createProfile` validates the student is `GRADUATED` (400
otherwise) and rejects a duplicate profile (409, on top of the DB
`@@unique`). `createCompany` is upsert-by-name.

`StudentPortalService`/`Controller` gained self-service methods
(`getOwnAlumniProfile`, `updateOwnAlumniProfile`,
`addOwnAlumniEducation`, `addOwnAlumniCareerHistory`,
`addOwnAlumniSkill`, `addOwnAlumniCertification`), all resolving via
`getOwnStudent` → `AlumniService.getOwnProfile` (404 "No alumni
profile exists for this account yet" if none) → delegating to the
underlying admin method.

### Real bugs found and fixed

1. **`student-portal.controller.ts` missing `Patch` import.** Adding
   `@Patch("alumni-profile")` needed `Patch` added to the existing
   `@nestjs/common` import — caught immediately by typecheck
   (`TS2304: Cannot find name 'Patch'`).
2. **Self-service career-history company picker 403'd** (found during
   browser verification, not the e2e suite — the e2e suite doesn't
   drive the web UI). The portal page's "add career history" form
   needs a list of companies to pick from, and was written to call the
   admin-only `listAlumniCompanies()` client method — which hits
   `GET organizations/me/alumni-companies`, gated by `alumni:view`.
   A student-portal user (Rohan, self-service alumnus) has no RBAC
   permissions at all, so this 403'd, leaving the company dropdown
   permanently empty and the self-service career-history form
   permanently unusable. Fixed by adding a genuinely separate
   self-service read endpoint, `GET organizations/me/portal/
   alumni-companies` (`StudentPortalController`, `JwtAuthGuard` only,
   no `@RequirePermissions`) — the company catalog is org-wide read
   data, same trust level as e.g. `listCourses`, safe to expose to any
   logged-in portal user. The admin-facing `alumni-companies` endpoint
   stays permission-gated since it's reached from the admin dashboard,
   not this portal. `packages/api-client` got a matching
   `listOwnAlumniCompanies()` method; `apps/web/src/app/portal/
   alumni/page.tsx` was pointed at it instead of the admin one.
3. **Self-service portal page never rendered career history at all**
   (found during browser verification): the initial `/portal/alumni`
   page had "My profile" / "Education" / "Skills" cards but no "Career
   history" card, even though the backend fully supported
   `addOwnAlumniCareerHistory` and `AlumniProfileRecord.careerHistory`
   was already in the API response. An alumnus's own career history —
   including entries an admin had added on their behalf — was
   invisible to them, and they had no UI to add their own. Fixed by
   adding a Career history card to the portal page, mirroring the
   admin dashboard's card (list + add form with a company picker),
   using the new self-service company endpoint above.

### Web UI

- `apps/web/src/app/dashboard/alumni/page.tsx` (new, admin) — Alumni
  profiles card (create from a `status === "GRADUATED"` student
  filter, list, "Manage" expand revealing Education/Career
  history/Skills sub-forms) + Companies card. Nav: new "Alumni &
  Career" group, `Award` icon (deliberately not `GraduationCap`, to
  stay visually distinct from the existing Students nav item).
- `apps/web/src/app/portal/alumni/page.tsx` (new, self-service) — "You
  don't have an alumni profile yet" message on a 404 rather than a
  crash (same pattern as the library staff-bridge notice); otherwise
  profile summary + update form, Education, Career history, and
  Skills cards.

## Explicitly not in this slice

- Alumni surveys, mentorship, achievements (8b), career opportunities/
  applications/services/graduate outcomes (8c) — separate slices.
- A public alumni directory using `isPubliclyVisible` — the field
  exists for future use, no directory page was built.
- Skill standardization (a `HostelLookup`-style catalog for
  `AlumniSkill`) — deliberately left flat free text, see Context above.
- Alumni-authored content moderation, profile photo upload, or any
  richer profile fields than the plan's own ERD names.

## Verified

- `pnpm -r typecheck`/`lint`/`build` clean across all six packages
  (the same pre-existing, unrelated `sso/page.tsx` lint failure from
  every prior Phase 7 slice, still untouched, still flagged
  separately — confirmed via `git log` that file was last touched by
  an earlier, unrelated commit, not this session).
- `services/api` e2e: one new comprehensive test (Alumni & Career,
  part 1) — 400 for a non-graduated student, 201 create, 409 duplicate
  profile, list, update, company upsert-by-name, education/career-
  history(+endDate update)/skill/certification add, detail fetch
  confirming all sub-records, skill removal confirming it's gone,
  self-service via a real `create-login` + `/auth/login` session (own
  profile matches admin-created one, own update, own skill add
  reflected), a second student with no profile getting a clean 404
  through the self-service endpoint, and cross-tenant isolation
  throughout. Passed clean standalone both before and after the two
  real bugs above were fixed (`-t "Alumni"`, 77 total/76 skipped/1
  passed, 31.8s for the one new test) — the bugs were both UI-only,
  not caught by the e2e suite since it doesn't drive the web UI, which
  is exactly why the full browser pass below is what caught them.
- Full browser pass, as the demo admin: marked demo student Rohan
  Thapa `GRADUATED`, created a real alumni profile for him (class of
  2026) through the actual UI, added a company ("Himalaya Tech",
  Software industry), added a career-history entry (Software Developer
  at Himalaya Tech, current) — all via real form submissions, each
  confirmed by its `201 Created` network response. Created a real
  portal login for Rohan, logged in as him, and confirmed
  `/portal/alumni` correctly showed his own profile ("Class of 2026")
  — which surfaced bug #3 above (career history missing entirely) and,
  once fixed, bug #2 (company picker 403). After both fixes: reloaded
  and confirmed the admin-created career-history entry now renders
  correctly; added a skill ("Python") and a second career-history
  entry ("Intern" at Himalaya Tech, from the self-service UI) and
  confirmed both a) the real `201 Created` network responses and b)
  both entries render correctly on a fresh page reload, alongside the
  original admin-created entry. All demo data left in place per this
  project's standing "don't clean up test/demo data" instruction.

## Next step (as of slice 8a)

Slice 8a done. Per this project's standing per-slice check-in rule,
"go-ahead" authorized starting Phase 8, not an indefinite override —
the next slice (8b, Alumni engagement: surveys/mentorship/achievements)
needs its own fresh go-ahead.
