import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Runtime traffic connects as app_runtime (no BYPASSRLS) so the RLS
    // policies in migration 20260817234200 are real enforcement, not a
    // no-op against an owner connection. Falls back to DATABASE_URL only
    // if RUNTIME_DATABASE_URL isn't set (e.g. a one-off local script).
    const runtimeUrl = process.env.RUNTIME_DATABASE_URL ?? process.env.DATABASE_URL;
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
