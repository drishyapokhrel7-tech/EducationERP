import { Module } from "@nestjs/common";
import { AccountingService } from "./accounting.service";
import { AccountingController } from "./accounting.controller";

@Module({
  providers: [AccountingService],
  controllers: [AccountingController],
  // FinanceModule and PayrollModule both import this to inject
  // AccountingService for auto-posting — AccountingModule never
  // imports either of them back (no cycle), same shape as AuthModule
  // importing CommunicationModule for DeliveryProvider.
  exports: [AccountingService],
})
export class AccountingModule {}
