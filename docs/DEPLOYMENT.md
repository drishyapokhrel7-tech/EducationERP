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
convenience, see `docs/LICENSING_EDITIONS_AND_CAPTCHA_NOTES.md`),
`CRON_SECRET`/`ALERT_EMAIL` (see "Cron & uptime monitoring" below).

**`education-erp-web`**: `NEXT_PUBLIC_API_URL` (the API project's
production domain), `NEXT_PUBLIC_LIBRARY_API_URL` (see
`docs/LIBRARY_SYSTEM_INTEGRATION_NOTES.md`), `NEXT_PUBLIC_OVEXA_ABOUT_URL`.
`NEXT_PUBLIC_*` vars are baked into the client bundle at build time —
changing one requires a redeploy, not just an env-var edit taking effect
on the next request, unlike the API's server-only vars.

## Cron & uptime monitoring

Two complementary pieces — set both, they cover different failure
modes (see `docs/OBSERVABILITY.md` for the full reasoning):

**1. The health watchdog Cron** (`GET /internal/health-watchdog`,
already wired in `services/api/vercel.json`'s `crons` array, schedule
`0 6 * * *` — once daily, safe on Vercel's free Hobby tier; tighten to
e.g. `*/30 * * * *` if the project is on a Pro plan, which allows
sub-daily cron frequency). To activate it in `education-erp-api`'s
Vercel project settings:

1. Set `CRON_SECRET` to any random string (`openssl rand -hex 32`
   works) — Vercel automatically sends this exact value as `Authorization:
   Bearer <CRON_SECRET>` on every Cron-triggered request once the env
   var exists, no extra config needed on either side.
2. Set `ALERT_EMAIL` to the address that should receive a failure
   email — sent via this project's own already-configured Gmail
   integration (`EMAIL_DRIVER=gmail`), no new account. Leave unset and
   a failure still logs server-side (visible in Vercel's own Logs tab)
   without emailing anyone.

This alone does **not** detect a total outage — a Cron job under the
same deployment can't run if the deployment itself is down. It only
catches an internal DB-unreachable failure while the API process is
still alive.

**2. An external uptime monitor**, for the case above doesn't cover —
the one genuine "is the service reachable from the internet at all"
check, since it runs on infrastructure independent of this deployment.
Any of these free tiers works; exact values to paste in once an
account exists:

| Field | Value |
|---|---|
| URL | `https://<api-domain>/health` |
| Method | `GET` |
| Expected status | `200` |
| Interval | 1–5 minutes |
| Alert contact | wherever the project owner wants to be paged |

No request body, no headers needed — `/health` is deliberately public
and unauthenticated (unlike the Cron watchdog above).

## Database migrations — run automatically as part of the build

`services/api/package.json`'s `vercel-build` script is `prisma generate
&& prisma migrate deploy`. This runs inside Vercel's own build
environment for every deploy — the correct place for it, not a
convenience: `DATABASE_URL` is marked a **Sensitive** env var on this
project (Settings → Environment Variables → the value is genuinely
unreadable after being set, even via `vercel env pull` — not just
hidden in the dashboard), so a migration run from anywhere outside
Vercel's own build/runtime context structurally cannot get at the real
owner-level connection string at all. Baking it into `vercel-build`
also resolves the expand/contract ordering concern for free: the
migration runs and must succeed *before* Vercel serves any traffic
from the new deployment, so the old code is never left running against
a schema it doesn't expect and the new code is never live against a
schema that hasn't migrated yet.

This was originally a separate manual step (`prisma migrate deploy` run
by hand before deploying) — changed once the Sensitive-var protection
made that impossible to do safely from outside Vercel's own build.
`RUNTIME_DATABASE_URL` (the non-owner, non-migration role — see
`docs/PHASE_1_NOTES.md`) is unaffected; only `DATABASE_URL` needed this
change.

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

## Deploying `services/ai`

`services/ai/Dockerfile` builds a real, verified image (CPU-only —
`face_model.py` pins `providers=["CPUExecutionProvider"]`, so no GPU
host is needed) with the InsightFace model **baked in at build time**
rather than left to download on the first real request — every
container starts already warm. Confirmed by actually building and
running it: `docker build`, then a container serving `GET /health` →
`{"status":"ok"}`, rejecting an unauthenticated `POST /v1/face/embed`
with 401, and returning a well-formed `200` with real ONNX inference
output on a valid image. This is a persistent, long-running process —
that's *why* it's a plain Dockerfile/host rather than a Vercel function
like the other two services, not an oversight.

Standing up real hosting is the one step only the account holder can
do — provisioning a host and setting its secrets is outside what this
session can perform on your behalf. Any Dockerfile-based host works;
two that fit this project's existing lightweight/no-paid-hard-dependency
posture (see `docs/PHASE_0_ARCHITECTURE.md` §2.3's AI-provider rule) and
need no separate container registry:

- **Railway**: `railway init`, then `railway up` from `services/ai/` —
  it builds the Dockerfile directly and assigns a public URL. Set
  `AI_SERVICE_API_KEY` (and optionally `FACE_MODEL_NAME`) in the
  project's **Variables** tab.
- **Fly.io**: `fly launch` from `services/ai/` (accept the detected
  Dockerfile, decline a Postgres/Redis add-on — this service needs
  neither), then `fly secrets set AI_SERVICE_API_KEY=...`.

Either way, the last step is updating `AI_SERVICE_URL` and
`AI_SERVICE_API_KEY` in `education-erp-api`'s Vercel environment
variables (see above) to point at the new host instead of
`localhost:8001`, then redeploying the API.

## What's not deployed yet

- **`services/ai` still has no *hosting* provisioned** — the Dockerfile
  above is real and verified, but nobody has run it against a real
  account yet, so `AI_SERVICE_URL` in `services/api/.env` still points
  at `localhost:8001` even outside local dev, and the face-match
  feature path (`biometric-policy`/`camera-events` modules) genuinely
  cannot reach a real AI service in production today. This is a stated
  gap, not something silently worked around.
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
