# Education ERP

AI-powered School & College ERP / Education Operating System. See
[`docs/CLAUDE_CODE_DEVELOPMENT_PLAN.docx`](./docs/CLAUDE_CODE_DEVELOPMENT_PLAN.docx)
for the full product plan, [`docs/PHASE_0_ARCHITECTURE.md`](./docs/PHASE_0_ARCHITECTURE.md)
for the architecture baseline, and [`docs/PHASE_1_NOTES.md`](./docs/PHASE_1_NOTES.md)
for what's actually running right now.

## Stack

- **Web**: Next.js, TypeScript, Tailwind, shadcn/ui (`apps/web`)
- **API**: NestJS, Prisma, PostgreSQL (`services/api`)
- **Queue**: Redis + BullMQ
- **Monorepo**: pnpm workspaces + Turborepo

Electron desktop clients and the Python/FastAPI AI service land in later
phases (see `docs/PHASE_0_ARCHITECTURE.md` §20).

## Getting started

```bash
pnpm install
```

Copy `.env.example` to `.env` at the repo root and fill in a Postgres
connection string (owner-level, for migrations) plus a second,
non-`BYPASSRLS` role for `RUNTIME_DATABASE_URL` — see
`docs/PHASE_1_NOTES.md` for why two roles. Copy `services/api/.env`
similarly (it's read independently by Prisma CLI and the Nest app).

Start Redis (either works, nothing in the app cares which):

```bash
docker compose -f infra/docker-compose.yml up -d
# or: brew install redis && redis-server
```

Run migrations and seed the role/permission catalogue:

```bash
cd services/api
pnpm exec prisma migrate dev
pnpm run prisma:seed
```

Optionally seed a demo organization ("Everest Academy & College",
Pre-School through Master's, real program/subject structure sourced from
two public Nepali institution sites — see `docs/PHASE_2_NOTES.md` slice
2c) to explore the app with realistic data:

```bash
pnpm run demo:seed   # idempotent; login: admin@everest-academy.demo / DemoPass123!
```

Run everything:

```bash
pnpm dev   # from the repo root, runs every app/service via Turborepo
```

Or individually:

```bash
pnpm --filter @education-erp/api dev     # :4000
pnpm --filter @education-erp/web dev     # :3000
```

## Testing

```bash
pnpm --filter @education-erp/api test        # unit
pnpm --filter @education-erp/api test:e2e    # e2e, including the RLS/tenant-isolation suite
pnpm typecheck && pnpm lint && pnpm build     # everything, via Turborepo
```
# EducationERP
