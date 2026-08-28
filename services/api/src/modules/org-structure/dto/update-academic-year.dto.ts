import { IsDateString, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateAcademicYearDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
