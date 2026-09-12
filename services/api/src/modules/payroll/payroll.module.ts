import { Module } from "@nestjs/common";
import { PayrollService } from "./payroll.service";
import { PayrollController } from "./payroll.controller";
import { AccountingModule } from "../accounting/accounting.module";

@Module({
  // Exports AccountingService — PayrollService injects it to
  // auto-post finalize/paid events to the ledger, atomically in the
  // same transaction as each event.
  imports: [AccountingModule],
  providers: [PayrollService],
  controllers: [PayrollController],
})
export class PayrollModule {}
