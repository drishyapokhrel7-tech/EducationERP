# Deployment & Release Management

Phase 8 (docs/CLAUDE_CODE_DEVELOPMENT_PLAN.docx §20, §22 "Production"
gate: "Docker/deployment...release documentation complete"). This
documents the deployment mechanism **actually in place** for this repo
today — two separate Vercel projects, linked via the `.vercel/` folders
already checked into each — not a generic deployment guide.

## Topology

| Component | Vercel project | Directory | Entry point |
|---|---|---|---|
| Web (Next.js) | `education-erp-web` | `apps/web` | Next.js's own build output |
| API (NestJS) | `education-erp-api` | `services/api` | `services/api/api/index.ts` |

Both are linked (`.vercel/project.json` in each directory) to the same
Vercel team. `services/api/vercel.json` rewrites every path to the one
serverless function at `api/index.ts`, so Nest's own routes (`/auth/
login`, `/health`, etc.) stay at their real paths instead of moving
under `/api` — Nest owns routing, Vercel just dispatches every request
to the one function.

`services/api/api/index.ts` boots Nest once per cold start (cached
across warm invocations of the same function instance via a
module-level promise, not re-initialized per request) and exports the
underlying Express app directly as the serverless handler — **not**
wrapped in `serverless-http`, which targets AWS Lambda's `(event,
context)` contract rather than Vercel's raw `(req, res)` one and
silently hangs every request if used here (a real bug this Phase 8
slice fixed, see the security-hardening commit). **This file must never
be broken** — it's the one thing standing between a passing build and a
production outage on every route at once.

`services/ai` (the Python/FastAPI face-match service) has **no
deployment configuration at all** — no `vercel.json`, no Dockerfile, no
linked project — see "What's not deployed yet" below.

## Environment variables

Set in each Vercel project's **Settings → Environment Variables**, not
committed anywhere (`.env*` is gitignored at both the workspace root and
`services/api`, see the security-hardening commit). Names only below —
pull real values from whoever holds them, never from a doc:

**`education-erp-api`** (`services/api/.env.example` is the local-dev
template; production needs the same names):
`DATABASE_URL`, `RUNTIME_DATABASE_URL` (see `docs/PHASE_1_NOTES.md` for
why two roles — one `BYPASSRLS` for migrations, one not, for the running
app), `JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL_SECONDS`, `PLATFORM_JWT_SECRET`
(deliberately separate from `JWT_ACCESS_SECRET` — see
`docs/LICENSING_EDITIONS_AND_CAPTCHA_NOTES.md`), `CORS_ORIGIN` (the
production web domain, not `localhost`), `PORT` (Vercel ignores this for
serverless but the local `pnpm start` path still reads it),
`STORAGE_DRIVER` (`google-drive` in production — `local` only makes
sense for a persistent-disk dev machine, which a serverless function
isn't), `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REFRESH_TOKEN`/
`GOOGLE_DRIVE_FOLDER_ID`, `EMAIL_DRIVER` (`gmail` in production) +
`GMAIL_SENDER_EMAIL`, `REDIS_URL`, `AI_SERVICE_URL`/`AI_SERVICE_API_KEY`
(currently unreachable in production — see below), `DISABLE_CAPTCHA`
(must be unset/`false` in production — it exists purely as a local-dev
convenience, see `docs/LICENSING_EDITIONS_AND_CAPTCHA_NOTES.md`).

**`education-erp-web`**: `NEXT_PUBLIC_API_URL` (the API project's
production domain), `NEXT_PUBLIC_LIBRARY_API_URL` (see
`docs/LIBRARY_SYSTEM_INTEGRATION_NOTES.md`), `NEXT_PUBLIC_OVEXA_ABOUT_URL`.
`NEXT_PUBLIC_*` vars are baked into the client bundle at build time —
changing one requires a redeploy, not just an env-var edit taking effect
on the next request, unlike the API's server-only vars.

## Database migrations — a manual step, stated plainly

`services/api/package.json`'s `vercel-build` script is `prisma generate`
only. **Vercel does not run `prisma migrate deploy` automatically** —
this is a real, deliberate gap to be explicit about rather than let a
reader assume migrations happen "somehow" on deploy:

```bash
cd services/api
DATABASE_URL="<production owner connection string>" pnpm exec prisma migrate deploy
```

Run this **before** deploying code that depends on the new schema (a
new required column with no default, for instance, would break the
still-running old code if migrated after deploy instead of before — the
usual expand/contract migration-ordering concern, worth remembering on
any breaking schema change even though this project hasn't needed a
formal expand/contract split yet at its current pace of schema change).
`prisma migrate deploy` needs the owner-level `DATABASE_URL`, not
`RUNTIME_DATABASE_URL` — the runtime role deliberately cannot alter
schema (see `docs/PHASE_1_NOTES.md`).

## Deploying

Both projects deploy the standard Vercel way — a push to `main` (or
whatever branch each project's dashboard is configured to auto-deploy)
triggers a build via each project's own dashboard/CLI integration;
`vercel --prod` from either directory works the same way for a manual
deploy. Order matters when a change touches both the schema and the API
that depends on it: migrate first (above), then deploy `education-erp-api`,
then `education-erp-web` if the change also touches the frontend contract.

### CI, run before every deploy

`.github/workflows/ci.yml` (new in this Phase 8 slice — no
`.github/workflows` existed before it) runs on every push/PR to `main`:
`pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r build`, and
`services/api`'s unit tests (`auth.service.spec.ts`, `shuffle.spec.ts` —
both fully mocked, no live database). It deliberately does **not** run
the `test:e2e` suite (real RLS-policy tests against a real Postgres
instance) — see the workflow file's own comment for why standing that up
safely in CI is separate infrastructure work. Run `pnpm --filter
@education-erp/api test:e2e` locally against a real (non-production!)
database before merging anything that touches auth, RLS, or tenant
isolation, matching this project's own established practice throughout
Phase 7/8.

## Rollback

Vercel keeps every previous deployment as an immutable, instantly
promotable artifact — the fastest real rollback for a bad *code* deploy
is **Vercel's dashboard → Deployments → pick the last-known-good one →
"Promote to Production"**, not a `git revert` + redeploy cycle (that's
the right move for actually fixing the bug afterward, but promoting an
old deployment is faster for stopping the bleeding). This works
independently for each of the two projects.

A rollback that also needs the **database** rolled back (a bad migration,
not just bad code) is a different, heavier operation — see
`docs/BACKUP_AND_RESTORE.md`'s PITR/branch-restore procedure. Rolling
back code alone while the schema has already moved forward can leave the
old code pointed at a schema it doesn't expect — check whether the
migration being rolled back from was additive (safe either order) or
breaking (roll back code and DB together) before promoting an old
deployment past a schema change.

## Bootstrapping a fresh environment

Beyond the standard `prisma migrate deploy` + role/permission seed
(`pnpm run prisma:seed`, idempotent) already covered in the README, two
Phase 8 additions need their own one-time step in a brand-new
environment:

```bash
cd services/api
PLATFORM_ADMIN_EMAIL="..." PLATFORM_ADMIN_PASSWORD="..." pnpm run platform:seed
```

creates the one cross-org `PlatformAdmin` account (see
`docs/LICENSING_EDITIONS_AND_CAPTCHA_NOTES.md`) — there is deliberately
no self-registration endpoint for this table, so a fresh environment has
no way into `/platform/login` without this step.

## What's not deployed yet

- **`services/ai`** (Python/FastAPI, face-match for the biometric
  attendance feature) has no deployment configuration at all —
  `AI_SERVICE_URL` in `services/api/.env` still points at
  `localhost:8001` even outside local dev. This is a real, stated gap,
  not an oversight to be silently worked around: the face-match feature
  path (`biometric-policy`/`camera-events` modules) genuinely cannot
  reach a real AI service in the current production deployment. Standing
  it up is future work — likely a Docker-based host (Railway/Fly.io/a
  small VM) rather than Vercel, since it needs a persistent process and
  a loaded ML model, not a cold-starting serverless function.
- **Redis**, in production, needs its own managed instance (Upstash is
  the natural Vercel-ecosystem fit, given `REDIS_URL`'s plain
  connection-string shape) — not itself deployed by this repo, just a
  required external dependency to provision once per environment.
- **`apps/exam-client`/`apps/cctv-client`** (Electron desktop clients,
  `docs/PHASE_0_ARCHITECTURE.md` §20's "land in later phases") already
  have a real local packaging step (`pnpm package` → `electron-builder
  --dir`), but no code-signing, auto-update server, or release-channel
  configuration — there is no distribution mechanism for either yet.
  `pnpm -r build`/`typecheck`/`lint` (and this slice's new CI workflow)
  already cover them as regular workspace packages; actual desktop
  distribution is separate, unstarted work.
