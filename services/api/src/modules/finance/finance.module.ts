import { Module } from "@nestjs/common";
import { FinanceService } from "./finance.service";
import { FinanceController } from "./finance.controller";
import { EsewaGatewayService } from "./esewa-gateway.service";

@Module({
  providers: [FinanceService, EsewaGatewayService],
  controllers: [FinanceController],
  // FinanceService: reused by StudentPortalModule's self-service
  // invoice/eSewa endpoints — same shared-service pattern as
  // DashboardsModule exporting DashboardsService for the self-service
  // dashboard. EsewaGatewayService: reused by BillingModule — a
  // stateless, generic "talk to eSewa" wrapper with zero invoice-
  // specific logic, so the platform's own edition-upgrade payments
  // reuse it directly rather than duplicating HMAC signing/status-
  // check logic for a second, unrelated purpose.
  exports: [FinanceService, EsewaGatewayService],
})
export class FinanceModule {}
