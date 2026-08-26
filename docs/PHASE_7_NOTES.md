# Phase 7 — Business Operations, built as slices

Companion to [`PHASE_0_ARCHITECTURE.md`](./PHASE_0_ARCHITECTURE.md) and
every prior phase's notes. Phase 7 (plan §14: "Finance & fee
management, HR & payroll, library, transport, hostel, inventory,
communication/notifications, document/certificate generation") is the
plan's business-operations layer — the first phase built entirely on
top of an already-complete academic core (Phases 1-4) and biometric
pipeline (Phase 6; Phase 5's general AI Gateway remains skipped in
favor of the Phase 6 work that was actually needed).

User said "phase 7-8" after Phase 6 closed. Sliced the same way every
prior phase has been, per the plan's own "do not implement the entire
platform in one operation" instruction (§21 step 17) — confirmed
explicitly with the user before starting. Planned breakdown,
dependency-ordered by what each domain actually needs from what
precedes it:

- **7a** Finance & fee management — fee structures, invoicing, manual
  payments, then real eSewa/Khalti online payment. Chosen as the first
  slice: it's the plan's most-specified business domain and the one
  every other Phase 7/8 domain (library fines, transport fees, hostel
  fees) will eventually attach an `Invoice` to.
- **7b** HR & payroll — builds on the existing `Employee`/staff model
  from Phase 2.
- ~~**7c** Library~~ — **cancelled** (user, 2026-08-26). Catalog,
  circulation, and fines already exist for real: the standalone
  `~/librarysystem` project was integrated into this ERP's own
  `apps/web` earlier in this session as a cross-cutting bridge feature
  (see `docs/LIBRARY_SYSTEM_INTEGRATION_NOTES.md`), including fines
  routing through 7a's `Invoice`/`FeeStructure` already. Building a
  second, native 7c library module would duplicate that. If library
  work is raised again, it means extending the existing integration
  (the ERP-staff→Librarian role bridge, CORS lockdown, overdue
  reminders — see that doc's own "next steps"), not starting 7c fresh.
- **7d** Transport — routes, vehicles, student assignment.
- **7e** Hostel — rooms, allocation, fees (same fee-routing story as
  7c).
- **7f** Inventory — assets, stock, procurement.
- **7g** Communication/notifications — SMS/email/push, likely the
  first slice needing a real outbound-provider integration decision
  (comparable to 7a-2's eSewa research).
- **7h** Documents/certificates — templated PDF generation (transcripts,
  bonafide certificates, ID cards).

Each slice needs its own explicit go-ahead when reached, same as every
other phase's slices. This document gets a new section per slice, same
convention as `PHASE_2_NOTES.md` through `PHASE_6_NOTES.md`.

## Slice 7a-1 — Finance: fee structures, invoicing, manual payments

User said "yes" to starting Phase 7 with Finance. Investigation before
planning found no monetary type precedent exists anywhere in this
schema — only `Float`, used for academic scores — so `Decimal
@db.Decimal(12, 2)` is the correct, financially-safe choice, and this
slice sets that precedent for every money field going forward. NPR is
the only currency the plan specifies (docx §14); no multi-currency
scope exists or was built.

No payment gateway is named anywhere in the plan. Asked the user
whether to build manual recording only or a real online gateway now;
they explicitly chose the bigger-scope option — **build real
eSewa/Khalti integration now** — over the recommended manual-only
path. That decision was then split into two dependency-ordered
slices, the same way every other large Phase 2-4 domain in this
project has been:

- **7a-1 (this slice)**: fee structures, invoicing, and manual payment
  recording (cash/bank transfer/cheque) — a complete, independently
  useful slice; an institution could run its entire fee-collection
  workflow on this alone.
- **7a-2 (confirmed next, not a "someday")**: the real eSewa online
  payment flow, layered on top of this slice's `Invoice`/`Payment`
  models — a gateway integration has to attach to real invoices that
  don't exist yet, so this is a dependency-ordering split, not a scope
  cut.

**eSewa vs Khalti sandbox research** (done before planning, so 7a-2
can start without repeating it): eSewa's ePay v2 sandbox
(`https://rc-epay.esewa.com.np/api/epay/main/v2/form`) is genuinely
public and self-service — a static `product_code=EPAYTEST`, a
published test secret key (`8gBm/:&EnhH.1/q`), HMAC-SHA256 over
`total_amount,transaction_uuid,product_code`, and published test
account credentials — confirmed directly against eSewa's own developer
docs, no merchant registration needed. Khalti's sandbox
(`https://dev.khalti.com/api/v2/epayment/initiate/`) requires a
personal `test_secret_key_...` obtained by registering at
`test-admin.khalti.com` — not something that can be done on the user's
behalf. This asymmetry is why 7a-2 is scoped as "build eSewa for
real," with Khalti left as an adapter-ready extension point pending
user-supplied credentials, rather than blocking on both.

## What shipped

**Schema** — new Finance section, twelve models, all money fields
`Decimal @db.Decimal(12, 2)`:

- `FeeCategory` — org-level catalog (Tuition, Library Fine, Transport
  Fee, ...).
- `FeeStructure` + `FeeStructureItem` — a named fee template scoped to
  `(programId, termId)` containing line items, the same
  header+line-item collapse this project already uses for
  `Curriculum`/`CurriculumSubject` and `Exam`/`ExamSubject`.
- `StudentFeeAssignment` — anchors to `studentEnrollmentId` (not
  separately to `studentId`+`termId`; the enrollment already carries
  both). Assignment *is* invoicing — creating the assignment and its
  resulting `Invoice` happen in one transaction, no separate "generate"
  step, matching how enrollment itself is a single action. A bulk
  variant (`assign-bulk`) assigns to every `ACTIVE` enrollment for that
  structure's program+term in one call.
- `Invoice` (`totalAmount` — an immutable gross snapshot taken at
  creation, never recomputed) + `InvoiceItem` (mirrors the fee
  structure's items at creation time, same snapshot reasoning as
  `Grade` staying stable after a `GradingScheme` might later change).
  Net payable, net paid, and overdue are all **computed on read**, not
  stored — no `OVERDUE` status column, no background job just to flip
  a status over time.
- `Payment` (`CASH`/`BANK_TRANSFER`/`CHEQUE` this slice; `ESEWA` is
  7a-2's addition) — partial payments allowed across several rows,
  matching real institutional practice.
- `Scholarship` (reusable org-level catalog) + `StudentScholarship`
  (an ongoing per-student assignment). Checked only at
  invoice-generation time; a match is materialized as a `Discount` row
  (`scholarshipId` set, `appliedBy` null) — a snapshot, not a live
  reference, so a later scholarship change never retroactively alters
  an already-issued invoice. Distinguished from an ad-hoc
  admin-applied `Discount` (`scholarshipId` null, real `appliedBy`).
- `Refund` — against a specific `Payment`, recorded as a ledger fact
  only; no programmatic gateway refund call exists in 7a-1 or 7a-2.
- `FinancialTransaction` — an append-only ledger (`INVOICE_CREATED` /
  `PAYMENT_RECORDED` / `DISCOUNT_APPLIED` / `SCHOLARSHIP_APPLIED` /
  `REFUND_ISSUED`). Deliberately **not** computed-on-read like
  `syllabus_progress` — money needs a real immutable audit trail;
  `Invoice`/`Payment` stay the live queryable state, the ledger is
  history only. Read access folded under the existing `invoice:view`
  RBAC permission rather than adding a ninth Finance resource, since
  it's a cross-cutting audit trail, not an owned entity — matching this
  project's precedent of child/junction concepts folding into a parent
  resource.

RLS + FK-vs-RLS-parent-guard pattern on all twelve new tables, same as
every prior slice. `recomputeInvoiceStatus` runs after every
payment/discount/refund mutation inside the same transaction: net
payable = total − discounts, net paid = payments − their own refunds,
status is `PAID` if net paid ≥ net payable (or net payable ≤ 0),
`PARTIALLY_PAID` if some but not all is paid, else `PENDING`.

**API** — new `finance` module under `organizations/me/`:
`fee-categories`, `fee-structures` (+ `:id/assign`, `:id/assign-bulk`),
`invoices` (list/get), `invoices/:id/payments`, `invoices/:id/discounts`,
`payments/:id/refunds`, `financial-transactions` (list, folded under
`invoice:view`), `scholarships`, `students/:id/scholarships`. Eight new
RBAC resources (`fee_category`, `fee_structure`,
`student_fee_assignment`, `invoice`, `payment`, `scholarship`,
`discount`, `refund`; 58 resources total), Super Admin/Organization
Admin only — same as every resource seeded so far; a dedicated
Accountant role remains a natural future refinement, not built here
since designing "what exactly can an Accountant do" is its own
decision, not implied by this slice.

**Web UI** — new `/dashboard/finance` page: fee category/structure
management (with dynamic line-item rows), single and bulk
assignment, an invoice list with an expandable detail view (line
items, record-payment form, apply-discount form), and scholarship
creation/assignment. New `Wallet` nav entry in the dashboard sidebar.

## Explicitly not in this slice (7a-2 and beyond)

- eSewa (or any) online payment — confirmed as the immediate next
  slice, needs this slice's `Invoice`/`Payment` models to exist first.
- A dedicated Accountant RBAC role.
- Automated invoice-overdue reminders/notifications (Phase 7's
  Communication domain, 7g).
- Any refund-API integration — refunds stay a manual ledger record in
  both 7a-1 and 7a-2.

## Verified

- `pnpm -r typecheck` / `lint` / `build` clean across all six packages.
- `services/api` e2e: full suite 54/55 (2 new Finance tests, both
  passing on every run across this window, isolated and full-suite
  alike). The one failure (`attendance reconciliation ... marks a
  student's attendance ...`) is in already-shipped Phase 6 slice 6d
  code, confirmed unrelated to this slice — a distinct occurrence from
  a similar-looking bug already fixed once in 6d's own history, with a
  documented theory (a `describe()`-body-scoped `new Date()` going
  stale across an 800+ second full-suite run). Flagged as a background
  task (`task_856b0766`) rather than fixed inline, since it's
  pre-existing infra this slice merely re-exposed, not caused. The two
  new tests cover: single and bulk fee-structure assignment with
  correct skip semantics on a repeat assignment, exact invoice-item
  snapshotting, partial-payment-to-`PAID` status transitions, a
  discount rejected when it would exceed the remaining balance,
  scholarship auto-application only to invoices generated *after* the
  scholarship is assigned (an already-issued invoice correctly left
  untouched), scholarship percentage/amount XOR validation, a refund
  rejected when it would exceed the payment's remaining amount,
  correct `FinancialTransaction` ledger rows for every action, and
  cross-tenant isolation throughout.
- Full browser pass, as the demo admin: navigated to
  `/dashboard/finance` and found the user had already exercised the
  fee-category, fee-structure, and single-assignment flows directly
  through genuine interactive use during this session (a "Library
  Fine" category, a fee structure, and a PENDING invoice for student
  Sita Gurung) — confirmed those flows work correctly against the real
  running API without needing to rebuild them. Opened that invoice's
  detail view (line items, both forms rendered correctly), recorded a
  full NPR 15.00 cash payment through the actual UI form, and confirmed
  via the invoice list that its status transitioned `PENDING` → `PAID`.
  Per this project's "don't disturb data you didn't create" principle,
  the pre-existing category/structure/invoice were left in place rather
  than cleaned up; the one new artifact from this pass — the payment
  itself — has no delete/void endpoint in this slice (a refund would
  only add a further ledger record, not remove it), so it was left as
  a real, correctly-recorded payment on that invoice rather than forced
  into an artificial "undo."

## Next step (as of slice 7a-1)

Slice 7a-1 done, stopped per plan §21 step 17. Next up per the
confirmed roadmap: **7a-2, real eSewa online payment integration** —
already scoped and sandbox-researched (see above), needs its own
explicit go-ahead to start. After that: 7b HR & payroll, then 7c-7h
per the breakdown above, each still needing its own go-ahead when
reached.

## Slice 7a-2 — real eSewa online payment integration

User said "go-ahead." Re-confirmed the exact ePay v2 contract directly
against eSewa's own developer docs before planning (form-POST
endpoint, required field names, the HMAC-SHA256 signature's exact
message format and base64 encoding, the redirect payload's shape, the
status-check endpoint and its full set of possible statuses) and
confirmed this environment has real outbound network access to both
the sandbox form endpoint and the status-check endpoint — so this
slice could be built and verified against the genuine sandbox, not a
mock.

Asked who should be able to trigger a payment — staff-assisted via the
admin Finance UI, self-service via the student portal, or both. **User
chose "both."** No parent/guardian login exists in this project, so
portal self-service means the student's own account pays their own
invoice; a guardian-facing portal remains a future extension.

## What shipped

**Schema**: one new model, `EsewaTransaction` (`transactionUuid`
unique, `status`: `INITIATED`/`COMPLETE`/`FAILED`/`CANCELED`,
`esewaRefId`, nullable `initiatedBy`). Deliberately kept separate from
`Payment` — same reasoning as `ClassSession` staying separate from
`AttendanceSession`: an initiated gateway attempt and money that
actually arrived are different owners with different lifecycles. Only
a `COMPLETE` row here ever produces a real `Payment`.
`PaymentMethod.ESEWA` had already been reserved in 7a-1's own
migration anticipating this slice, so no enum migration was needed
here.

**`EsewaGatewayService`** (new, alongside `FinanceService`) — a thin
protocol wrapper mirroring `AiGatewayService`'s shape (plain
`process.env.X ?? sandboxDefault`, no `ConfigService`/validation
schema, matching this project's only existing precedent for an
external-service client): builds the signed form payload
(`buildPaymentForm`), verifies a redirect's signature
(`verifySignature`), and performs the real server-to-server status
check (`checkStatus`). Sandbox defaults (`EPAYTEST` + the published
test secret key + both sandbox URLs) are baked in so this works out of
the box; overridable via env once real merchant credentials exist.
`success_url`/`failure_url` reuse the existing `CORS_ORIGIN` env var
(the web app's already-known origin) rather than adding a new one.

**The actual security design, stated explicitly since it's the part
most likely to be gotten wrong in a real integration**:
`verifySignature` is defense-in-depth, not the security boundary —
eSewa's own JSON number formatting in the redirect payload isn't
byte-for-bit guaranteed to reproduce what was originally signed, so a
failed check is logged (`Logger.warn`) but never the sole reason to
reject, and a passing one is never the sole reason to credit. The real
gate is `checkStatus()` — a live call back to eSewa's own server keyed
by `transaction_uuid`, which a forged or replayed redirect cannot
fake. `FinanceService.confirmEsewaPayment` only ever creates a
`Payment` when that live call reports `COMPLETE`, and is idempotent —
a reloaded callback page or a double-submitted click looks up the
existing `EsewaTransaction` by its unique `transactionUuid` and
returns the already-recorded outcome instead of crediting twice.

**RBAC / routing** — two thin controller surfaces over the same shared
`FinanceService` methods: admin routes
(`invoices/:id/esewa/initiate`, `esewa/verify`) reuse the existing
`payment:create` permission, since a gateway-confirmed payment is
still fundamentally "this invoice got paid" — no new RBAC resource.
Portal routes (`portal/invoices`, `portal/invoices/:id/esewa/initiate`,
`portal/esewa/verify`) extend the existing `student-portal` module's
`JwtAuthGuard`-only self-service pattern; `FinanceModule` now exports
`FinanceService` so `StudentPortalModule` can reuse it directly, same
pattern as `DashboardsModule` exporting `DashboardsService` for the
self-service dashboard. Both `initiateEsewaPayment` and
`confirmEsewaPayment` take an optional `ownerStudentId` — set only on
the portal path — and 404 (not 403, matching every other portal IDOR
guard) if the invoice or transaction doesn't belong to the caller's
own linked student.

**Web UI**: `apps/web/src/lib/esewa.ts`'s `submitEsewaForm` builds a
hidden form and calls `.submit()` — a genuine full-page browser
redirect, not a fetch, since eSewa's own login/approval page is what
the payer interacts with next. Admin: a "Pay with eSewa" action added
next to the existing "Record payment"/"Apply discount" forms on
`/dashboard/finance`, plus a new
`/dashboard/finance/esewa/callback` page. Portal: a new
`/portal/invoices` page (the student's own invoice list — the one
piece of self-service scope this slice adds, since the portal had no
Finance visibility before) with the same "Pay with eSewa" action, plus
`/portal/esewa/callback`, and a new "My Invoices" nav entry in
`portal/layout.tsx`.

## Explicitly not in this slice

- Khalti — unchanged reasoning from 7a-1 (needs your own
  `test-admin.khalti.com` credentials).
- A guardian/parent login — portal self-service pays through the
  existing student account.
- Programmatic refunds through eSewa's own refund API — refunds stay a
  manual ledger record.
- A background reconciliation job for abandoned `INITIATED`
  transactions (payer closes the tab mid-flow) — this slice's
  redirect+status-check flow is the primary path; a sweep/cron for
  stragglers is a reasonable future add-on once this project has a
  real scheduler, not before.

## Verified

- `pnpm -r typecheck` / `lint` / `build` clean across all six packages.
- `services/api` e2e: two new tests, run against eSewa's **real**
  sandbox (not mocked), both passing on every run, isolated and
  alongside the full suite alike. First test: initiates a payment,
  independently recomputes the HMAC signature against eSewa's own
  published algorithm and confirms it matches exactly (not just that a
  signature is present), confirms a forged redirect claiming
  `COMPLETE` for a transaction that was never actually paid is
  correctly rejected (proving `checkStatus`, not the redirect payload,
  is the real gate) with the invoice provably left untouched, confirms
  a malformed payload 400s cleanly and an unknown `transaction_uuid`
  404s, and confirms cross-tenant isolation. Second test: the portal
  self-service flow end to end (student sees only their own invoices,
  no `student` field leaked on the self-service list, initiates a
  real signed payment for their own invoice) and the IDOR guard — a
  different student can neither initiate nor confirm a payment against
  someone else's invoice, 404 either way.
- Full e2e suite re-run clean after this slice (no regressions in any
  earlier phase).
- Full browser pass, both channels: as the demo admin, built a fresh
  fee structure/invoice, opened it, clicked "Pay with eSewa," and
  confirmed the browser genuinely redirected to eSewa's real sandbox
  login page showing the exact correct amount (NPR 25.00) — proving
  the whole initiate → sign → redirect chain is wired correctly
  end-to-end through the real UI, not just the API. Repeated the same
  check via the student portal (created a temporary login, confirmed
  `/portal/invoices` rendered the real invoice and redirected to the
  sandbox with the correct amount, NPR 30.00). **Could not complete an
  actual sandbox payment** — eSewa's login page is gated by a real
  reCAPTCHA, and solving CAPTCHAs is a prohibited action; this is a
  genuine, stated tooling limitation, not a shortcut taken. The
  automated e2e tests above cover the part that actually matters most
  (a forged/incomplete transaction is correctly refused, never
  silently trusted), and the browser pass confirms the entire chain up
  to that same boundary works for real. All test fee
  structures/invoices and the temporary student login created for this
  pass were removed afterward via a one-off cleanup script, scoped
  only to what this pass itself created — the user's own pre-existing
  "Library Fine" test data was left untouched, per this project's
  standing principle.

## Next step (as of slice 7a-2)

Slice 7a-2 done, stopped per plan §21 step 17. **This closes the
originally-approved eSewa/Khalti online-payment scope** (Khalti
explicitly deferred, see above) — Finance (7a) now supports the full
fee lifecycle: catalog → structure → invoicing → manual or real online
payment → discounts/scholarships/refunds → an audit ledger. Next up
per the Phase 7 breakdown: **7b, HR & payroll**. Needs its own
go-ahead; expect it to build on the existing `Employee`/staff model
from Phase 2 the same way Finance built on `StudentEnrollment`.

## Slice 7b-1 — Leave Management (HR & Payroll, part 1)

The plan's own scope for this domain is thin — §5 "Staff & HR" just
says "...leave and payroll," and §6's ERD list gives six bare table
names: `salary_structures, payroll, payroll_items, leave_types,
leave_requests, staff_leave_balances`. Everything else in this domain
(`Employee`, `StaffType`, `Designation`, `EmploymentHistory`,
`Qualification`, `TeacherProfile`) was already built in Phase 2 slice
2b — this slice's real new scope is just those six tables, split the
same way Finance was: **7b-1 (this slice) = leave**
(`leave_types`/`leave_requests`/`staff_leave_balances`), **7b-2 (next,
confirmed) = payroll** (`salary_structures`/`payroll`/`payroll_items`).
Payroll naturally comes second since a real payroll run plausibly
needs to know about unpaid leave taken in the period.

No staff/employee self-service portal exists anywhere in this project
— only students got one (Phase 4e). `Employee.userId` is optional
("set only for staff who also log in"), but no login flow, no portal
routes, nothing employee-facing has ever been built. Leave requests in
this slice are therefore **admin/HR-recorded on an employee's
behalf** — the same precedent as `StudentAttendance`/`StaffAttendance`
being admin-recorded, not self-service. A real staff self-service
portal is a materially bigger, separate undertaking (new login
mechanism, new auth guard pattern), not implied by "add leave
management."

## What shipped

**Schema** — three new models: `LeaveType` (org-level catalog: name,
code, `defaultDaysPerYear`, `isPaid`, `carryForward`);
`StaffLeaveBalance` (one row per `employeeId`+`leaveTypeId`+`year`,
storing only the **allocation** — `usedDays`/`remainingDays` are
**computed on read** by summing `days` across that combination's
`APPROVED` `LeaveRequest` rows, the same reasoning as this project's
`syllabus_progress` precedent: cheaply derivable, avoids a second
source of truth); `LeaveRequest` (`startDate`/`endDate`, `days`
computed server-side from the date range at creation, `status`
`PENDING`/`APPROVED`/`REJECTED`/`CANCELLED`, `reviewedBy`/
`reviewedAt`/`reviewComment`). RLS on all three, same pattern as every
prior slice.

**Two-layer balance check, deliberate**: `assertWithinBalance()` runs
both at request-creation time (summing only currently-`APPROVED`
requests, so several `PENDING` requests can coexist even if their sum
would exceed the balance) and again at approval time (re-checking,
since other requests may have been approved in the meantime). Tested
explicitly: a request that individually passes the creation-time check
can still be correctly rejected at approval time if another request
consumed the balance first. **"No allocation = untracked, not
zero"** — if no `StaffLeaveBalance` row exists for an employee+type+
year, a request against that type is allowed freely; not every leave
type needs quota tracking (e.g. unpaid leave).

**API** — new `leave` module under `organizations/me/`: `leave-types`
(GET/POST), `leave-balances` (POST to allocate — an upsert, since
re-allocating is a legitimate admin correction, not a conflict),
`employees/:id/leave-balances` (GET, augmented with computed
used/remaining), `leave-requests` (GET, filterable by `employeeId`/
`status`; POST), `leave-requests/:id/approve|reject|cancel` (only from
`PENDING`, 409 otherwise — same "reject, don't silently no-op"
precedent as every other status transition in this project). Two new
RBAC resources, `leave_type` and `leave_request` (the latter folds
balance-allocation actions in too — same "closely-related concepts
share one resource" precedent as `financial_transactions` folding
under `invoice`), Super Admin/Organization Admin only.

**Web UI** — new `/dashboard/leave` page, the established
one-page-many-Cards structure: Leave Types (list/add), Balances (pick
an employee, allocate a type+year+days, see computed used/remaining),
Requests (status filter, create on behalf of an employee, approve/
reject/cancel). New `CalendarOff` nav entry.

## Explicitly not in this slice

- Payroll (`salary_structures`/`payroll`/`payroll_items`) — confirmed
  as 7b-2, immediately next.
- A staff/employee self-service portal.
- Half-day leave, carry-forward *processing* (the `carryForward` flag
  is stored on `LeaveType` for future use; nothing in this slice rolls
  unused days into the next year automatically).
- An HR Manager-specific RBAC role.

## Errors caught and fixed

- **`defaultDaysPerYear: 0` rejected** — the DTO originally used
  `@IsPositive()`, which rejects `0`, a legitimate value for an
  untracked/unpaid leave type. Caught by the e2e test (`expected 201,
  got 400`), not by typecheck/lint. Fixed to `@Min(0)`.
- **Balances panel not refreshing after Approve** — the same `useSWR`
  staleness bug class already documented in the RBAC/Roles-Permissions
  work: a page with multiple `useSWR` hooks where one hook's displayed
  data (`usedDays`/`remainingDays`) is a side effect of an action whose
  primary mutation targets a *different* hook (`leave-requests`). Fixed
  by also calling `balances.mutate()` in the Approve button's success
  callback (Reject/Cancel don't need it — they only ever fire from
  `PENDING`, never `APPROVED`, so they never change a computed
  balance). Re-verified live in the browser: approved a second request
  and watched the Balances card update from "3/12 used — 9 remaining"
  to "5/12 used — 7 remaining" with no page reload.

## Verified

- `pnpm -r typecheck` clean across all six packages. `pnpm -r lint`
  clean for every package this slice touched; the one failing package
  (`apps/web`, an `sso/page.tsx` `react-hooks/set-state-in-effect`
  error) is pre-existing, untouched by this slice, and belongs to
  earlier unrelated SSO/Vercel-deployment work — confirmed via `git
  status`/`git log` showing zero uncommitted changes to that file.
- `services/api` e2e: one comprehensive new test covering allocation +
  idempotent re-allocation, creation-time balance rejection (400), the
  two-layer approval-time re-check, an unallocated/untracked leave type
  being allowed freely, reject-with-comment, cancel, 409 on
  re-cancelling/re-approving a terminal request, final computed-balance
  verification, and cross-tenant isolation — passing standalone and
  inside a full-suite run.
- Full browser pass, as the demo admin: created a real employee (no
  demo employee data existed in the seeded org — a discovery made
  mid-pass), created a real "Sick Leave" leave type, allocated a 12-day
  balance for 2026, submitted and approved two real leave requests
  through the actual UI, confirmed the Balances card tracked correctly
  after each approval (including the live-refresh fix above). All test
  data (leave request, balance, leave type, employee, and its
  designation/staff-type) removed afterward via a one-off cleanup
  script scoped to only what this pass created; confirmed clean via a
  fresh page load showing "No leave types yet." / "No requests."

## Next step (as of slice 7b-1)

Slice 7b-1 done, stopped per plan §21 step 17. Next up per the
confirmed roadmap: **7b-2, Payroll** (`salary_structures`/`payroll`/
`payroll_items`) — needs its own explicit go-ahead to start.

## Slice 7b-2 — Payroll (HR & Payroll, part 2)

User said "start now" to the 7b-1 check-in. Docx §6's ERD list gives
three bare table names, no field-level spec, no tax/statutory rules,
no payslip-generation spec (payslip/document generation belongs to the
plan's separate, not-yet-started documents/certificates domain, 7h) —
verified directly against the docx before planning, confirming nothing
else in the plan text touches payroll. Used `EnterPlanMode` given the
genuinely open design questions (salary structure shape, payroll
lifecycle, how to handle statutory deductions) that the plan's three
bare table names don't answer.

**Key design call, stated explicitly since the plan doesn't address
it**: deductions (income tax, provident fund, ...) are modeled as
generic, admin-configurable line items (fixed amount or % of basic),
not hardcoded Nepali tax-slab/SSF calculation logic. Real tax brackets
are government fiscal-year policy that changes annually — encoding
today's rates as literal code would silently go stale. Mirrors this
project's own `GradingScheme` precedent (admin-configurable bands in
JSON, not hardcoded cutoffs) applied to the same class of problem.

## What shipped

**Schema** — `SalaryStructure` (org-level reusable template: `name`,
`basicSalary`) + `SalaryStructureItem` (`type` `EARNING`/`DEDUCTION`,
`name`, and exactly one of `amount`/`percentOfBasic` — same XOR
precedent as `Scholarship`'s percentage/amount-exclusive rule).
`Employee.salaryStructureId` (new nullable FK on the Phase-2 model,
same "later slice adds a field to an earlier phase's model" precedent
as `ExamSubject.questionBankId`) — a raise just repoints the FK, no
date-ranged assignment history needed since `Payroll` snapshots its
items at generation time. `Payroll` (one row per employee+period,
`status` `DRAFT`/`FINALIZED`/`PAID`/`CANCELLED`, `grossPay`/
`totalDeductions`/`netPay` computed and frozen at finalize time — same
immutable-snapshot precedent as `Invoice.totalAmount`, reuses the
existing `PaymentMethod` enum from Finance) + `PayrollItem` (snapshotted
from the structure at generation, mirrors `InvoiceItem`/
`FeeStructureItem`).

**A real correctness gap caught while writing the e2e test, fixed
before it shipped**: the first version of `generatePayroll` only
snapshotted the salary structure's own earning/deduction *items* —
the employee's actual basic salary itself never became a payable line,
so `grossPay` would have summed only allowances, silently omitting the
core salary from every payroll ever generated. Fixed by always adding
a "Basic Salary" `EARNING` item first, with the structure's own items
layered on top of it.

**Unpaid-leave integration** — the reason 7b-2 was ordered after
7b-1: at generation time, sums `LeaveRequest` days where
`status=APPROVED` and `leaveType.isPaid=false` starting within the
target month (reuses 7b-1's `usedDaysFor` query shape), adds one
auto-generated `DEDUCTION` item (`basicSalary / daysInMonth × days`) if
nonzero. This item behaves like any other — HR can remove/adjust it
while the payroll is still `DRAFT`.

**Lifecycle**, mirroring `LeaveRequest`'s explicit-transition/
409-on-invalid-transition precedent: **Generate** (bulk per period,
mirrors Finance's `assign-bulk` — skips an employee who already has a
`Payroll` row for that period, same skip-semantics as bulk fee
assignment) → **Finalize** (`DRAFT` only, freezes the three computed
totals) → **Mark paid** (`FINALIZED` only, requires a `paymentMethod`)
→ **Cancel** (`DRAFT` or `FINALIZED` only — never `PAID`, since money
already disbursed is a real-world fact, not undoable here). Item
add/remove is `DRAFT`-only.

**API** — new `payroll` module under `organizations/me/`:
`salary-structures` (+ `:id/items`), `employees/:id/salary-structure`
(assign/unassign), `payroll/generate`, `payroll` (list/detail),
`payroll/:id/items`, `/finalize`, `/pay`, `/cancel`. Two new RBAC
resources, `salary_structure` and `payroll` (the latter folds
`payroll_items` in too — same folding precedent as `leave_request`/
`invoice`), Super Admin/Organization Admin only.

**Web UI** — new `/dashboard/payroll` page, the established
one-page-many-Cards structure: Salary Structures (dynamic
earning/deduction item-row builder, same pattern as Finance's
fee-structure builder), employee assignment, a Generate-payroll form
(month/year → bulk create, shows generated/skipped counts), a Payroll
list (status filter) with an expandable detail view (items,
Finalize/Mark-paid/Cancel).

## Explicitly not in this slice

- Real Nepali income-tax-slab or SSF calculation logic — deductions
  stay generic, admin-configurable line items (see above).
- Payslip/PDF generation — belongs to the plan's separate
  documents/certificates domain (7h), not started.
- A staff self-service portal (viewing one's own payslips) — admin/HR
  only, matching 7b-1's precedent.
- Date-ranged salary-structure history — a structure change only
  affects future payroll generation.
- Half-day/partial-day unpaid-leave proration — whole days only, same
  scope line 7b-1 drew for leave itself.

## Verified

- `pnpm -r typecheck` clean across all six packages; `pnpm -r lint`
  clean for everything this slice touched (the one pre-existing
  `apps/web` `sso/page.tsx` failure is untouched by this slice, same
  as noted in 7b-1).
- `services/api` e2e: one comprehensive new test — creates a salary
  structure with a fixed-amount deduction and a percent-of-basic
  earning, assigns it, generates payroll for a period with an
  in-period approved unpaid-leave request and confirms the exact
  snapshotted items (including the auto unpaid-leave deduction) and
  correct gross/deductions/net math, confirms re-generating the same
  period skips the employee, walks item add/remove (DRAFT-only, 409
  once `FINALIZED`), finalize (locks and freezes totals, rejects a
  second finalize), mark-paid (requires a payment method), cancel from
  both `DRAFT` and `FINALIZED` but rejected from `PAID` (409),
  unassigning a structure excludes an employee from the next generate,
  and cross-tenant isolation throughout — passed cleanly on the first
  run, both standalone and inside the full 60-test suite (56 passing,
  4 pre-existing unrelated `services/ai`-dependent failures).
- Verification against the real running system: created a real
  employee, salary structure, and generated/finalized/paid a real
  payroll via direct authenticated API calls, confirming byte-exact
  correct responses at every step (structure creation, item
  snapshotting, gross/deduction/net computation, status transitions).
  The web UI itself was confirmed correct piecemeal rather than in one
  continuous click-through: the Payroll list rendered the real
  generated record correctly ("Ramesh Verify — 8/2026 · net — DRAFT")
  on repeated loads, and clicking it correctly targeted the exact
  right resource id in the network request. **A session-level Browser
  pane tooling limitation prevented a single continuous UI
  click-through this pass**: concurrent `fetch()` calls to the API
  origin from within the harness's browser intermittently failed with
  a misleading "CORS policy" error (reproduced directly — two
  concurrent `fetch()`s to the same origin both fail with `TypeError:
  Failed to fetch`, while sequential ones and direct `curl` calls
  succeed every time; the API server's own CORS headers were confirmed
  correct via `curl -i`). This is a tooling artifact of this session's
  Browser pane, not a product bug — stated plainly per this project's
  standing precedent (same class of limitation as 7a-2's eSewa
  CAPTCHA gate) rather than claimed as a full clean pass it wasn't.
  All test data (payroll + items, salary structure + items, employee,
  designation, staff type) removed afterward via a one-off cleanup
  script; confirmed clean via direct API calls returning empty lists
  for employees/salary-structures/payroll.

## Next step (as of slice 7b-2)

Slice 7b-2 done, stopped per plan §21 step 17. **This closes Phase
7's HR & Payroll domain** (7b-1 leave + 7b-2 payroll) — Staff & HR
(plan §5/§6) is now fully built out: employees/designations (Phase 2b)
+ leave + payroll.

User said "cancel 7c" immediately after — confirmed as cancelling the
slice outright (redundant with the already-shipped library
integration), not deferring it; see the breakdown list at the top of
this document for the reasoning. Next up per the Phase 7 breakdown:
**7d, Transport** (routes, vehicles, student assignment) — needs its
own explicit go-ahead. After that: 7e hostel, 7f inventory, 7g
communication, 7h documents/certificates — each still needing its own
go-ahead when reached.
