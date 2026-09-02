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
- **An uptime monitor** (e.g. a free tier of UptimeRobot/Better Uptime/
  Checkly, or Vercel's own Cron+fetch if preferred) polling `GET
  https://<api-domain>/health` on a short interval (1–5 min) and alerting
  on a non-200 — this is genuinely not wired up yet and is a real,
  concrete next action, not something the code alone can provide.
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
