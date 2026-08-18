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

## Next step

Both slices done, stopped per plan §21 step 17. Phase 2 continues with
Academic structure (`subjects`, `courses`, `curriculum`,
`teaching_assignments`, `class_schedules`, `rooms`, `periods`) or Student
lifecycle (`students`, guardians, enrollment — now unblocked, since both
Programs/Sections and Staff exist) next.
