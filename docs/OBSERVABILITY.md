# Observability

Phase 8 (docs/CLAUDE_CODE_DEVELOPMENT_PLAN.docx §20, §22 "Production" gate:
"...monitoring, health checks, logging...complete"). What's below is an
honest account of what this app actually does today, not an aspirational
list — see "Explicitly not covered" for the real gaps.

## Health checks

`GET /health` (`services/api/src/common/health.controller.ts`) runs
`SELECT 1` against the database via Prisma and returns:

- `200 {"status":"ok","database":"ok"}` when the DB is reachable.
- `503 {"status":"error","database":"unreachable"}` when it isn't.

This is a real connectivity probe, not a static `200` — it's the one
deliberate exception to this codebase's own no-raw-queries convention
(justified: no tenant table touched, no user input, standard
minimal-overhead probe). Point any uptime monitor (see "What to wire up
in production" below) at this endpoint.

A second, unrelated health surface exists at `GET /queue/health/ping` →
`GET /queue/health/:jobId` (`services/api/src/queue/`) — a BullMQ
round-trip proving Redis + the queue worker are both alive. This is
useful as a *queue infrastructure* check, not a general app health
check; `/health` above is the one to wire an uptime monitor to.

## Request-level logging

- **`AllExceptionsFilter`** (`services/api/src/common/
  all-exceptions.filter.ts`, global) logs the full stack trace of any
  genuinely-unexpected error via Nest's own `Logger` before returning a
  generic, non-leaking 500 to the client. Every already-thrown
  `HttpException` (the overwhelming majority of this app's error paths —
  `NotFoundException`, `ConflictException`, validation errors, etc.)
  passes through unchanged; this filter's real job is making sure the
  *unexpected* case is never silent.
- **Nest's own `RouterExplorer`/`NestApplication` startup logs** (visible
  in `pnpm dev`'s console output, and in Vercel's function logs in
  production) list every mapped route and confirm a clean boot — the
  first thing worth checking after a deploy.
- **`LoginEvent`** (`services/api/prisma/schema.prisma`) records every
  login attempt (`success: boolean`, `ipAddress`, `userAgent`,
  timestamp) — written in `AuthService.login`, queryable for a real
  audit trail of authentication activity per organization.
- **`AuditLog`** exists as a general-purpose audit table but is
  currently written from only four modules — RBAC role/permission
  changes, camera/face-match events, biometric policy changes, and auth
  — stated plainly as **partial, not universal** coverage. Extending it
  to every mutating endpoint would be a much larger, separate change;
  today it covers the highest-sensitivity actions (who can access what,
  and biometric/surveillance data), which is where an audit trail matters
  most first.

## What to wire up in production (infrastructure, not app code)

This app emits the signals above; actually monitoring them in production
is an infrastructure step, done once per deploy target, not app code:

- **Vercel's own dashboard** (Project → Logs, and → Observability if
  enabled on the plan) already captures every serverless function
  invocation's console output — including this app's `Logger` calls —
  with no extra wiring. This is the first place to look after a
  production error.
- **A real external uptime monitor** — a free tier of UptimeRobot,
  Better Uptime, or Checkly, configured to poll `GET
  https://<api-domain>/health` on a short interval and alert on a
  non-200. This is the one genuinely complete answer to "is the
  service reachable from the internet at all" — it runs on
  infrastructure independent of this deployment, so it's the only
  option that can detect a *total* outage. Not wired up yet — it needs
  an account only the project owner can create; see
  `docs/DEPLOYMENT.md`'s Cron section for exact config values ready to
  paste in.
- **`GET /internal/health-watchdog`** (`services/api/src/modules/
  health-watchdog/`, wired to Vercel Cron via `services/api/vercel.json`)
  is a smaller, complementary piece that needed no new external account
  at all — it reuses this project's own already-configured Gmail
  sending. On a schedule, it re-runs the same DB check as `/health` and,
  if the database is unreachable, emails `ALERT_EMAIL` via
  `DeliveryProvider` (the same one Communication/auth already use).
  Guarded by a `CRON_SECRET` bearer token, checked fail-closed (a
  missing secret rejects every request, matching `services/ai`'s own
  `require_api_key` precedent) — verified live: no/wrong secret → 401,
  correct secret with a healthy DB → 200, correct secret with a
  simulated DB failure → 503 and a server-side error log (the actual
  Gmail-send branch was reviewed but not fired in verification, to
  avoid dispatching a real unsolicited email). **Its real limitation,
  stated plainly**: since it's a Cron job under the *same* Vercel
  deployment, it can never detect the deployment itself being fully
  down — only an internal failure (DB unreachable) while the API
  process is still alive to run it. It does not replace the external
  monitor above; it complements it.
- **Neon's own console** (Monitoring tab) shows connection count, query
  latency, and storage growth for the database directly — worth a glance
  when investigating a slow response, no separate tool needed.

## Explicitly not covered

- **Structured/centralized logging** (e.g. shipping logs to Datadog,
  Better Stack, or similar) — Vercel's own log capture is judged
  sufficient at this project's current scale (see `docs/PHASE_8_NOTES.md`
  performance-optimization's own "scale assumptions" note for the same
  reasoning pattern); revisit if real production log volume/retention
  needs ever exceed what Vercel's dashboard offers.
- **Distributed tracing / APM** (request-level timing breakdowns across
  services) — no evidence this app's actual latency profile needs it;
  same "appropriateness is a measured-load decision" standard applied
  throughout this project's Phase 8 work.
- **Alerting beyond the uptime monitor above** (e.g. paging on elevated
  5xx rate) — a real enhancement, but needs a specific on-call
  expectation to design against, which doesn't exist for this project
  yet.
- **`services/ai`** (the Python/FastAPI face-match service) has no
  health check or production logging story at all yet — see
  `docs/DEPLOYMENT.md`'s "What's not deployed yet" section; it isn't
  deployed anywhere today, so there's nothing yet to monitor.
