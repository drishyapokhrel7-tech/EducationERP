import { Controller, Get, Headers, HttpException, HttpStatus, Logger, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { DeliveryProvider } from "../communication/delivery-provider";

// A second, INTERNAL health surface distinct from the public
// GET /health (common/health.controller.ts) — this one is meant to be
// hit only by a scheduled trigger (Vercel Cron, configured below in
// vercel.json), and its job is to ALERT on failure via email rather
// than just report status back to whichever client happens to ask.
//
// Real but genuinely partial, stated plainly rather than oversold: if
// this whole Vercel deployment is down, a Cron job under the SAME
// deployment can't run either, so this can never catch a total
// outage — only an internal failure (the database unreachable) while
// the serverless function itself is still alive to run this route.
// docs/OBSERVABILITY.md's external-uptime-monitor recommendation is
// the one this doesn't replace.
@Controller("internal/health-watchdog")
export class HealthWatchdogController {
  private readonly logger = new Logger(HealthWatchdogController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: DeliveryProvider,
  ) {}

  @Get()
  async check(@Headers("authorization") authorization: string | undefined) {
    const expected = process.env.CRON_SECRET;
    // Fail closed, matching services/ai's own require_api_key
    // precedent — a missing server-side secret must never silently
    // accept every request. Unlike GET /health, this route is not
    // meant to be publicly callable at all (Vercel automatically sends
    // this exact header on a configured Cron invocation once
    // CRON_SECRET is set as a project env var — see docs/DEPLOYMENT.md).
    if (!expected || authorization !== `Bearer ${expected}`) {
      throw new UnauthorizedException("Invalid or missing cron secret");
    }

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", database: "ok", alerted: false };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const alertEmail = process.env.ALERT_EMAIL;
      let alerted = false;
      if (alertEmail) {
        const result = await this.delivery.sendEmail(
          alertEmail,
          "Education ERP: database health check failed",
          [
            `The scheduled health watchdog could not reach the database at ${new Date().toISOString()}.`,
            "",
            `Error: ${message}`,
            "",
            "The API process itself is still running (this route ran) — its database",
            "connection specifically is failing. See docs/OBSERVABILITY.md and",
            "docs/BACKUP_AND_RESTORE.md.",
          ].join("\n"),
        );
        alerted = result.status === "SENT";
      } else {
        // No configured recipient — still fail loudly server-side
        // (Vercel's own Cron invocation log shows the non-2xx below
        // as a second signal even with no email wired up).
        this.logger.error(`Health watchdog DB check failed and ALERT_EMAIL is not configured: ${message}`);
      }
      throw new HttpException(
        { status: "error", database: "unreachable", alerted },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
