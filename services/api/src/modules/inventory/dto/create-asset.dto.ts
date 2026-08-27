import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, MinLength } from "class-validator";

export class CreateAssetDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsString()
  @MinLength(1)
  assetTag!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  purchaseCost?: number;
}
