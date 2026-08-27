import { IsInt, IsNumber, IsPositive, IsString } from "class-validator";

export class AddPurchaseOrderItemDto {
  @IsString()
  itemId!: string;

  @IsInt()
  @IsPositive()
  quantityOrdered!: number;

  @IsNumber()
  @IsPositive()
  unitPrice!: number;
}
