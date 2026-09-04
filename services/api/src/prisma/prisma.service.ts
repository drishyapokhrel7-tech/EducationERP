import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

// Prisma's own default connection_limit, when a connection string
// doesn't set one explicitly, is `num_physical_cpus * 2 + 1` — on a
// Vercel serverless function (typically allocated a single vCPU or a
// fraction of one) that computes to as little as 3. Confirmed live in
// production as the actual cause of a real P2028 ("unable to start a
// transaction in the given time") once concurrent tenant-scoped work
// (platform-organizations.service.ts's own org-list scan) went even
// modestly above that — batches of 8 concurrent withTenant
// transactions worked fine against a local dev connection's much
// larger default pool, but failed hard in the real deployed function.
// Neon's own pooled endpoint (the `-pooler` hostname already in use
// here) comfortably supports far more than Prisma's serverless-sized
// default, so this raises the ceiling explicitly rather than staying
// pinned to a formula tuned for a different kind of deployment — this
// benefits any endpoint doing more than a couple of concurrent
// withTenant calls, not just the one that surfaced the problem.
// Respects an explicit connection_limit already present in the URL
// (a deliberate override should win over this default).
function withConnectionLimit(url: string | undefined, limit: number): string | undefined {
  if (!url) return url;
  if (/[?&]connection_limit=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}connection_limit=${limit}`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Runtime traffic connects as app_runtime (no BYPASSRLS) so the RLS
    // policies in migration 20260817234200 are real enforcement, not a
    // no-op against an owner connection. Falls back to DATABASE_URL only
    // if RUNTIME_DATABASE_URL isn't set (e.g. a one-off local script).
    const runtimeUrl = withConnectionLimit(process.env.RUNTIME_DATABASE_URL ?? process.env.DATABASE_URL, 10);
    super({ datasources: { db: { url: runtimeUrl } } });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Runs `fn` with the Postgres session-local tenant GUC set, so RLS
   * policies (see migration 0002) scope every query inside `fn` to
   * `organizationId`. Never call raw `this.$queryRaw` for tenant data
   * outside this wrapper.
   */
  async withTenant<T>(organizationId: string, fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return this.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(
          `select set_config('app.current_organization_id', $1, true)`,
          organizationId,
        );
        return fn(tx as unknown as PrismaClient);
      },
      // Prisma's default is 5000ms — too tight in practice: a query with
      // nested includes, or the first query after a Neon connection has
      // gone idle (serverless cold-start), can push past it on its own,
      // failing with "Transaction already closed" for reasons that have
      // nothing to do with a runaway transaction. Reproduced for real via
      // the demo org's student list (nested guardian include) once the
      // dev DB connection wasn't warm. 15s is generous without masking an
      // actually-stuck transaction.
      { timeout: 15000 },
    );
  }
}
