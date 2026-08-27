import { IsInt, IsOptional, IsString } from "class-validator";

// A manual, out-of-band stock correction (damage write-off, a
// physical count correcting a discrepancy, initial stock entry for
// an item that predates this system). type is always ADJUSTMENT —
// IN/OUT movements only ever come from receiving a PurchaseOrder,
// not this endpoint.
export class CreateStockAdjustmentDto {
  @IsString()
  itemId!: string;

  // Signed: positive increases stock, negative decreases it.
  @IsInt()
  quantity!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
