import { Module } from "@nestjs/common";
import { FinanceService } from "./finance.service";
import { FinanceController } from "./finance.controller";
import { EsewaGatewayService } from "./esewa-gateway.service";

@Module({
  providers: [FinanceService, EsewaGatewayService],
  controllers: [FinanceController],
  // Reused by StudentPortalModule's self-service invoice/eSewa
  // endpoints — same shared-service pattern as DashboardsModule
  // exporting DashboardsService for the self-service dashboard.
  exports: [FinanceService],
})
export class FinanceModule {}
