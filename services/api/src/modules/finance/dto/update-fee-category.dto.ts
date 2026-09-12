import { IsOptional, IsString, MinLength } from "class-validator";

export class UpdateFeeCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Maps this category's invoice items to a ledger account (e.g.
  // "Tuition Fee" -> a "Tuition Revenue" account) — see
  // AccountingService's posting rules. Pass an empty string to clear
  // the mapping back to the org's default Fee Revenue account.
  @IsOptional()
  @IsString()
  revenueAccountId?: string;
}
