import { IsDateString, IsOptional, IsString } from "class-validator";

export class CreateEmploymentHistoryDto {
  @IsString()
  designationId!: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
