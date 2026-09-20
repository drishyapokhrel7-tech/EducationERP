import { IsBoolean, IsDateString, IsOptional, IsString, MinLength } from "class-validator";

export class CreateHealthVisitDto {
  @IsDateString()
  visitDate!: string;

  @IsString()
  @MinLength(1)
  reason!: string;

  @IsOptional()
  @IsString()
  treatmentGiven?: string;

  @IsOptional()
  @IsBoolean()
  referredExternally?: boolean;
}
