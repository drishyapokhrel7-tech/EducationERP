# Backup & Restore

Phase 8 (docs/CLAUDE_CODE_DEVELOPMENT_PLAN.docx §20, §22 "Production" gate:
"...backups, restore...complete"). This document is deliberately about
*this project's actual database host's actual mechanism*, not a generic
backup strategy — see the "Explicitly not covered" section at the bottom
for what that mechanism does not reach.

## What's covered: Neon Postgres (the database)

The database (`DATABASE_URL`/`RUNTIME_DATABASE_URL` in `services/api/.env`)
is [Neon](https://neon.tech), a managed Postgres host
(`ep-little-shape-az0wtrl8-pooler.c-3.ap-southeast-1.aws.neon.tech` at the
time of writing). Neon's backup mechanism is not a nightly-dump-to-S3
model — it's continuous, storage-level point-in-time recovery (PITR):
every write is retained, not just snapshots, so a restore can target any
timestamp within the plan's retention window, not just a fixed daily
checkpoint.

### Verifying retention is configured as expected

1. Log in to the [Neon console](https://console.neon.tech) for this
   project.
2. Open **Settings → Backup & restore** (or **Branches → Restore** on
   older console versions).
3. Confirm the **restore window** shown there matches what the plan
   actually pays for — retention length is plan-tier-dependent (it can
   range from a few hours on a free tier to 30 days on a scaled plan) and
   is the one setting worth checking after any plan change, since a
   shorter-than-expected window is a silent gap until the day it's
   needed.

### Performing a restore

Neon's restore is branch-based, not an in-place overwrite — this is a
safety property worth understanding before an incident, not just at
restore time:

1. In the Neon console, go to the project's **Branches** tab.
2. Create a new branch from the main branch, choosing **"Restore to a
   point in time"** and picking the target timestamp (or an LSN, if the
   incident is tied to a known transaction).
3. This produces a **separate, fully independent branch** with its own
   connection string — the current (possibly-bad) data is untouched.
   Verify the restored branch has what's expected (spot-check a few
   tables, or point a local `.env` at it and run the app against it)
   *before* doing anything destructive to the original.
4. Once verified, either:
   - **Point the app at the restored branch** by updating
     `DATABASE_URL`/`RUNTIME_DATABASE_URL` (in Vercel's project env vars,
     see `docs/DEPLOYMENT.md`) to the new branch's connection string, or
   - **Promote the branch** to replace `main` via Neon's own "set as
     primary" action, if the console offers it for this plan tier.
5. Either path requires **re-running the RLS runtime role grant** if the
   restored branch is materially older than the last migration that
   touched `RUNTIME_DATABASE_URL`'s permissions — see
   `services/api/prisma/migrations/*_row_level_security` and
   `docs/PHASE_1_NOTES.md` for why the app runs under a second,
   non-`BYPASSRLS` role. A branch restored from before that role existed
   won't have it; one restored from after will.

### What a restore does *not* need touched

Because RLS policies, indexes, and every constraint live in the same
Postgres instance Neon is backing up, a PITR restore brings all of that
back exactly as it was at the target timestamp — there is no separate
"restore the schema" step. `prisma migrate deploy` should **not** be
re-run against a freshly-restored branch unless the restore point
predates a real migration that needs re-applying going forward (i.e.
normal forward migration, not a backup-specific step).

## Explicitly not covered by Neon's backup

Neon backs up the **database only**. Two other kinds of state exist in
this app and are **not** part of a Postgres restore:

- **Uploaded files** (`STORAGE_DRIVER` in `services/api/.env` —
  `google-drive` in production, per `docs/PHASE_1_NOTES.md`/the storage
  module's own driver comments). Files living in Google Drive have
  Google's own account-level retention/trash behavior, not this
  project's — there is no automated cross-check that a `LocalFile`/
  photo-URL row in Postgres still has a live file behind it after an
  independent Drive-side deletion, and a DB restore to an earlier point
  won't undo a Drive-side change made after that point (or vice versa).
  This asymmetry is a known, accepted gap at this project's current
  scale — revisit only if file/database consistency after a real
  incident ever becomes a demonstrated problem, not speculatively.
- **Redis** (`REDIS_URL`) — used today only for BullMQ's health-check
  queue (see `docs/OBSERVABILITY.md`), which holds no data worth
  restoring; nothing here needs backing up as of this Phase 8 slice. If
  a future feature puts real, non-reproducible state in Redis, that
  feature's own plan needs to say how it's backed up — this document
  doesn't cover a use that doesn't exist yet.

## Explicitly not in this slice

- Automated backup-verification tooling (a scheduled job that spins up a
  restored branch and runs a smoke check against it) — a real
  enhancement, but net-new infrastructure beyond what "document what the
  host provides and how to use it" (the Production gate's actual wording)
  asks for.
- A second, independent backup destination outside Neon (e.g. periodic
  `pg_dump` to cold storage) — Neon's own PITR is the documented,
  verified mechanism; a belt-and-suspenders second copy is worth
  revisiting if this project's risk tolerance changes, not assumed here.
