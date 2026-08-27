import { IsOptional, IsString } from "class-validator";

export class CreatePurchaseOrderDto {
  @IsString()
  supplierId!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
