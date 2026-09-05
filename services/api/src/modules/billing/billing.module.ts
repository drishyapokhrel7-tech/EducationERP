import { Module } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { BillingController } from "./billing.controller";
import { FinanceModule } from "../finance/finance.module";

@Module({
  // FinanceModule exports EsewaGatewayService — reused directly here,
  // not duplicated (see BillingService's own class doc).
  imports: [FinanceModule],
  providers: [BillingService],
  controllers: [BillingController],
})
export class BillingModule {}
