import { IsBoolean, IsDateString, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateHealthVisitDto {
  @IsOptional()
  @IsDateString()
  visitDate?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  reason?: string;

  @IsOptional()
  @IsString()
  treatmentGiven?: string;

  @IsOptional()
  @IsBoolean()
  referredExternally?: boolean;
}
