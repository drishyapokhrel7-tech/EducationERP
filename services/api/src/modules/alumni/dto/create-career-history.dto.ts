import { IsDateString, IsOptional, IsString, MinLength } from "class-validator";

export class CreateCareerHistoryDto {
  @IsString()
  companyId!: string;

  @IsString()
  @MinLength(1)
  jobTitle!: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
