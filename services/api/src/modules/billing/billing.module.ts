import { Module } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { BillingController } from "./billing.controller";
import { FinanceModule } from "../finance/finance.module";
import { CommunicationModule } from "../communication/communication.module";

@Module({
  // FinanceModule exports EsewaGatewayService — reused directly here,
  // not duplicated (see BillingService's own class doc).
  // CommunicationModule exports DeliveryProvider — used to notify
  // Ovexa staff of a manual upgrade request.
  imports: [FinanceModule, CommunicationModule],
  providers: [BillingService],
  controllers: [BillingController],
})
export class BillingModule {}
