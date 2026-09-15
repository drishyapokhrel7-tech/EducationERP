import { IsInt, IsNumber, IsOptional, IsPositive } from "class-validator";

export class UpdateLibrarySettingsDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  loanPeriodDays?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  finePerDayRate?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  maxActiveLoans?: number;
}
