import { IsInt, IsOptional, IsPositive, IsString, MinLength } from "class-validator";

export class CreateItemDto {
  @IsString()
  categoryId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  sku!: string;

  @IsString()
  @MinLength(1)
  unit!: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  reorderLevel?: number;
}
