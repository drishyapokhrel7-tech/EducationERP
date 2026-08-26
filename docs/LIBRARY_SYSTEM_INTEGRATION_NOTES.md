# Library System integration — bringing ~/librarysystem into the ERP web app

Companion to [`PHASE_0_ARCHITECTURE.md`](./PHASE_0_ARCHITECTURE.md) and
the `PHASE_*_NOTES.md` files, but deliberately not one of them — this
isn't a new native ERP module or a numbered Phase 7 slice, it's a
**frontend bridge** into a separate, already-complete standalone
project at `~/librarysystem` (NestJS API on port 4100, Prisma/Postgres,
a Python face-recognition microservice on port 4200). That project was
built from a SAD report that explicitly scopes the library as "an
integrated module of the Education ERP," and its own Phase 7 already
built the integration primitives librarysystem's own docs call
FR-13/FR-15: `POST /auth/erp-login` (credential-passthrough — forwards
a student's real ERP identifier/password server-to-server to
educationERP's own `/auth/login`, auto-provisions a library `Member`
from the matching ERP student, returns a library JWT), roster sync
(`POST /erp/sync-roster`), and fee posting (an overdue-return fine can
push a real `Invoice` into this ERP's own Finance module from slice
7a-1). None of that had a UI anywhere — librarysystem's own `apps/web`
is an empty placeholder, the only existing frontend is its Expo mobile
app. This work gives it a real one, inside this ERP's own web app.

User confirmed (via `AskUserQuestion`, twice — once on which project
"integrate the library system" meant, once on how much feature depth)
the **full feature surface**, covering both a student-facing
`/portal/library` section and a staff-facing `/dashboard/library`
section: catalog management, circulation with real browser camera
face-capture, ISBN/OCR cataloguing, fines, reservations, reports, and
roster sync.

**This is a pure frontend integration** — `~/librarysystem`'s own
backend is never modified, only consumed as a REST API from a new part
of `apps/web`. Confirmed reachable and CORS-open
(`app.enableCors()` with no origin restriction) from
`http://localhost:3020`, so no backend change was needed to call it
from the browser.

## What shipped

**`apps/web/src/lib/library-api.ts`** — a new, small, purpose-built
client, deliberately **not** built on `@education-erp/api-client`'s
`createApiClient` (that factory's ~250 methods are hardcoded to this
project's own route/type surface and would be meaningless against a
different backend). `createLibraryApiClient(getAccessToken)` is a
factory, mirroring `packages/api-client`'s own `createApiClient`
parameterization — instantiated **twice** (`libraryStaffApi`,
`libraryMemberApi`), each bound to its own token source. Covers the
full route table: auth (`erpLogin`, `staffLogin`), catalogue
(categories, books, `isbnLookup`, `ocrScan`), membership (list/get,
`enrollFaceTemplate`), circulation (list, `issueBook`, `returnBook`),
fines (list, `payFine`, `postFineToErp`), reservations (list, create,
cancel), system-config (get/update), reports (overdue, most-borrowed,
fine-collection), and `syncRoster`. Local TS interfaces for
`Book`/`Category`/`Member`/`Transaction`/`Fine`/`Reservation`/
`SystemConfig` live in this same file — no shared package, nothing
else in this monorepo needs library types.

**`apps/web/src/lib/library-auth-storage.ts`** — `createSessionStore(key)`
factory (mirrors `auth-storage.ts`'s localStorage +
`useSyncExternalStore` pattern), instantiated twice under **two
different keys**: `education-erp.library-staff-session` and
`education-erp.library-member-session`. See "A real bug" below for why
this had to be two separate stores, not one shared session.

**`apps/web/src/components/library/face-capture.tsx`** — a reusable
`getUserMedia` video preview + "Capture" button (canvas snapshot →
base64 JPEG + Blob), used by both the staff issue/return flow and
member face-template enrollment. `localhost` counts as a secure
context, so this works over plain `http://localhost:3020` in dev.
Always paired with a manual-override fallback — a denied/unavailable
camera degrades to that, never a dead end, matching librarysystem's
own "face verification is never blocking" design.

**`/portal/library`** (new page, new "Library" nav entry in
`portal/layout.tsx`): a one-time "Connect to Library" form
(identifier pre-filled from the ERP session, password re-entered —
the ERP session's own password isn't retained client-side after its
own login, so this is a real, necessary step) calling `erpLogin`;
catalog search (works even before connecting, `GET /books` is
public); once connected, "My Loans"/"My Fines"/"My Reservations"
(all self-scoped by the library API itself, `memberId` forced from
the JWT) and a "Reserve" action.

**`/dashboard/library`** (new page, new "Library" nav entry in
`dashboard/layout.tsx`): a "Library staff login" form (real
librarysystem Librarian/Administrator credentials — see the
architecture gap below); once connected, the same one-page-many-Cards
structure `/dashboard/finance` already established: Catalog
(categories, books, an ISBN-lookup button and an OCR-cover-scan file
input that both **prefill** the add-book form rather than
auto-submitting), Members (list, face-template enrollment), Circulation
(issue/return with `FaceCapture` + a manual-override checkbox, open
loans), Fines (list, mark paid, post-to-ERP), Reservations (staff-wide
list), Reports (overdue / most-borrowed / fine-collection), Settings
(fine rate / loan period / face-match threshold /
`erpFeePostingEnabled` toggle, and a "Sync roster from ERP" button).

## A real, unavoidable architecture gap — stated, not worked around

`erp-login` only ever produces a `MEMBER` session — mapping an ERP
staff account to a library Librarian/Administrator role was explicitly
left unaddressed when librarysystem's own Phase 7 built that endpoint,
and fixing that means changing librarysystem's own backend, out of
scope here. So `/dashboard/library` needs its own real, separate
librarysystem staff login — it cannot silently inherit the ERP admin's
session the way the portal side can.

## A real bug found and fixed via this slice's own browser pass

The first version of this slice used **one shared** library session
store for both the staff dashboard and the student portal. Verifying
it live: signed in to `/dashboard/library` as library staff, then
navigated to `/portal/library` **without signing out** — and the
portal silently rendered the *staff* session's data under "My Loans" /
"My Fines" (every open transaction and the wrong member's fine, not
the actual logged-in ERP student's own). This is exactly the kind of
bug this project's whole history has repeatedly caught only through
the manual browser pass, never through typecheck/lint/build — the
type system had no way to know one session's token was being reused
in the wrong context. Fixed by splitting the store into two
independent ones (`library-auth-storage.ts`'s two `createSessionStore`
instances, two separate `libraryStaffApi`/`libraryMemberApi` clients)
under two different localStorage keys, so a staff session in the
browser can never leak into the portal's "my own data" view again —
re-verified live afterward with a real ERP student login, confirmed
the portal now correctly shows an empty/own-scoped view.

**Two smaller real bugs, also caught only by hitting the real API**:
the `most-borrowed` report's actual field is `borrowCount`, not
`count` as first assumed (rendered as blank "— loans" before the fix);
the `fine-collection` report's actual shape is
`{countAssessed, totalAssessed, countCollected, totalCollected,
countOutstanding, totalOutstanding, ...}`, not the guessed
`{paid, unpaid}` — both fixed and re-verified against the real running
API before this slice was considered done.

## Explicitly out of scope

- Any change to `~/librarysystem`'s own backend, including its
  currently wide-open CORS default and the missing ERP-staff→Librarian
  role bridge — both real, worth fixing eventually, but belong to that
  project.
- A shared `packages/library-api-client` — not justified with one
  consumer.
- Server-side/httpOnly-cookie token storage for the new library
  sessions — matches the existing ERP session's own already-documented
  Phase-1 localStorage shortcut, not a regression introduced here.

## Verified

- `pnpm -r typecheck` / `lint` / `build` for `apps/web` clean.
- Full browser pass against the real, running librarysystem API (real
  seed data: 2 books, 2 categories, 7 members including 4 real
  ERP-linked demo students) and the real running educationERP API:
  - **Staff side**: added a real category, issued a real book to a
    real ERP-linked student (Rohan Thapa) via manual override
    (confirmed `availableCopies` decremented, `issueFaceVerified:
    "UNAVAILABLE"`), returned it (confirmed `availableCopies`
    incremented back), enabled ERP fee posting, posted a real
    pre-existing unpaid fine to the ERP — confirmed via a direct
    `GET .../invoices/:id` against educationERP's own API that a real
    `Invoice` (NPR 10, `Library Fine` category, PENDING) now existed
    for the correct student — then disabled fee posting again,
    triggered a real roster sync (`Found 4 students, 0 employees — 0
    created, 4 updated, 0 suspended`).
  - **Student/portal side**: connected via a real, freshly-created ERP
    student login through the actual `erp-login` credential-passthrough
    flow, confirmed the portal correctly showed that student's own
    (empty) loans/fines/reservations — not the staff session's data,
    confirming the session-separation fix — placed a real reservation
    (confirmed a 409 on a book with available copies, matching the real
    business rule, then a real reservation on a book with zero
    available copies), and cancelled it.
  - **Camera face-capture**: the UI wiring (permission prompt, video
    preview, capture→base64) was exercised and confirmed to request
    camera access correctly, but **could not complete a real face
    match** — this dev machine has no attached webcam and the Browser
    pane blocks camera access outright, the same environment
    limitation already documented for `apps/cctv-client` in Phase 6.
    Manual override is what was actually verified end-to-end for
    issue/return.
- All test artifacts from this pass were cleaned up afterward: the
  test category, the temporary ERP student login, and — since posting
  a fine to the ERP has no "unpost" endpoint on either side — the real
  `Invoice`/`FeeStructure`/`StudentFeeAssignment` it created in
  educationERP were removed directly via a one-off Prisma script, and
  the corresponding `Fine.postedToErpAt`/`erpInvoiceId` were reset to
  `null` on the librarysystem side to match, restoring both databases
  to exactly their pre-existing state (confirmed via a final
  cross-check against both APIs).

## ERP-staff → Librarian role bridge (closes the gap above)

User said "add librarian role and manage existing application" right
after cancelling Phase 7 slice 7c (Library) as redundant with this
integration — this closes the one real gap this document itself
flagged: `POST /auth/erp-login` only ever produced a `MEMBER` session,
so `/dashboard/library` needed a separate real librarysystem login.

**A pleasant discovery made while implementing**: educationERP already
has a *system* role literally named `Librarian`, seeded since Phase 1
alongside `Accountant`/`HR Manager`/`Transport Manager`/etc. — this
whole per-domain role catalog was anticipated from the very start.
Granting library access needs **zero new educationERP UI or code**: an
org admin just assigns the existing `Librarian` system role to a staff
member via the already-built `/dashboard/roles-permissions` page (the
same page also lets them create an org-scoped custom role of that same
name if they'd rather scope it differently — the bridge checks the
role's name, not whether it's a system or custom role).

**How it works**: `POST /auth/login`'s JWT payload already carries
`roles: string[]` (role names, from `issueTokens` in
`services/api/src/modules/auth/auth.service.ts`). librarysystem's
`AuthService.erpLogin` (`~/librarysystem/apps/api/src/auth/
auth.service.ts`) now decodes that token (via `JwtService.decode` —
no signature verification needed, since it's the direct, trusted
response to the exact login call librarysystem itself just made, not
a token presented by a third party) and checks for `"Librarian"`. If
present and the ERP user is an employee, a `Staff` row is
upserted (`erpRefId` = the ERP employee id — a field that already
existed in the schema, commented "used to authenticate via SSO once
wired up," anticipating exactly this) and a real `LIBRARIAN` session
is issued instead of `MEMBER`; no `Member` row is created for that
path. Any employee without the role, and every student, keeps the
unchanged `MEMBER` behavior. Scoped to `LIBRARIAN` only, not
`ADMINISTRATOR` — admin-level access stays on the existing seeded
login (`admin`/`Admin@123`).

`Staff.passwordHash` became nullable (one small migration) — an
ERP-bridged Staff row never has a local password, same reasoning
already applied to `Member.passwordHash`.

**Web UI**: `/dashboard/library`'s login card now offers "Connect via
ERP" (identifier pre-filled from the ERP session, mirrors
`/portal/library`'s existing pattern exactly) alongside the original
separate-credentials form. Since one shared backend endpoint can now
return either session type, the frontend checks `result.user.role`
before storing it — a `MEMBER` result is rejected with a clear message
("ask an admin to grant the Librarian role"), never silently saved
into the staff session store. Silently accepting the wrong session
type there would reopen the exact session-leakage bug this
integration's own original slice already found and fixed once (see
above) — this check exists specifically to prevent a repeat.

**A real pre-existing bug found and fixed along the way, unrelated to
this feature**: `~/librarysystem/apps/api/src/create-app.ts` directly
imports from `express` (`import { json } from 'express'`), but
`express` was never declared as a direct dependency of `apps/api`'s
own `package.json` — it only ever resolved because `@nestjs/platform-
express` happened to pull a copy into the shared pnpm store, which
worked under looser hoisting but breaks under pnpm's strict
per-package isolation. Running the app fresh (`node dist/src/main`)
surfaced `Cannot find module 'express'` immediately. Fixed by adding
`express` as an explicit dependency (`pnpm --filter @lis/api add
express@4.22.1`, matching the version already resolved
transitively) — this was blocking verification of the actual feature,
not a drive-by unrelated change.

**Verified**: `pnpm --filter @lis/api build`/`lint` clean;
`pnpm -r typecheck`/`lint` clean on the educationERP side (same one
pre-existing unrelated `sso/page.tsx` lint failure noted elsewhere in
this session). Full real end-to-end pass against both running
systems: created a real ERP employee+user, assigned a (test, org-
scoped) "Librarian" role, called `erp-login` directly — confirmed a
real `LIBRARIAN` session with a correctly-upserted, idempotent `Staff`
row (`passwordHash: null`, `erpRefId` set, same row id on a second
login, not duplicated). Confirmed the negative case: an employee
*without* the role still gets a `MEMBER` session, exactly matching
prior behavior. Confirmed live in the browser: connecting with the
Librarian-role account rendered the full real staff dashboard
(categories, books, "Connected to Library as librarian" toast);
connecting with the non-Librarian account correctly showed the
rejection message and did not store a session. All test data (ERP
user/employee/role, the auto-created `Staff` row) removed afterward;
confirmed clean via direct API calls.

## Running both systems together

`~/librarysystem`'s API isn't in this repo's `.claude/launch.json`
(different repo). To run the integration locally: Postgres
(`brew services start postgresql@16`) and a plain `redis-server
--daemonize yes` (same no-config-file workaround documented in
`erp-education-project` memory) need to be up, then
`pnpm --filter @lis/api dev` from `~/librarysystem` (port 4100), the
face service (`services/face`, port 4200) if face-capture is being
exercised, alongside this repo's own `education-erp-api`/
`education-erp-web`. Seeded librarysystem staff credentials:
`admin`/`Admin@123`, `librarian`/`Librarian@123`.
