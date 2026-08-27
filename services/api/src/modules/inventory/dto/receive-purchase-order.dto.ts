import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsInt, IsPositive, IsString, ValidateNested } from "class-validator";

class ReceiptLine {
  @IsString()
  purchaseOrderItemId!: string;

  @IsInt()
  @IsPositive()
  quantity!: number;
}

// Receiving is deliberately its own step, not implied by creating the
// PO — mirrors this project's own "generate then finalize" precedent
// (Payroll) and "raise then resolve" precedent (Hostel complaints):
// stock only actually moves once goods are confirmed received, not
// when they're merely ordered. Partial receipt is allowed (a shipment
// can arrive in parts) — each line just adds to quantityReceived and
// creates one StockMovement(IN) row.
export class ReceivePurchaseOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiptLine)
  lines!: ReceiptLine[];
}
