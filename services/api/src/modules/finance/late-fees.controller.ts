import { Controller, Get, Headers, Logger, UnauthorizedException } from "@nestjs/common";
import { FinanceService } from "./finance.service";

// Same CRON_SECRET-gated, non-RBAC internal surface as
// HealthWatchdogController — meant to be hit only by a scheduled
// trigger (Vercel Cron, see vercel.json), not by a logged-in user.
@Controller("internal/apply-late-fees")
export class LateFeesController {
  private readonly logger = new Logger(LateFeesController.name);

  constructor(private readonly finance: FinanceService) {}

  @Get()
  async apply(@Headers("authorization") authorization: string | undefined) {
    const expected = process.env.CRON_SECRET;
    if (!expected || authorization !== `Bearer ${expected}`) {
      throw new UnauthorizedException("Invalid or missing cron secret");
    }

    const result = await this.finance.applyLateFees();
    this.logger.log(
      `apply-late-fees: ${result.organizationsProcessed} organizations checked, ${result.invoicesCharged} invoices charged`,
    );
    return result;
  }
}
