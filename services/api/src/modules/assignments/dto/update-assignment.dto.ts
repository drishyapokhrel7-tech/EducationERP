import { IsBoolean, IsDateString, IsNumber, IsOptional, IsPositive, IsString, MinLength } from "class-validator";

export class UpdateAssignmentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsBoolean()
  allowResubmission?: boolean;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  maxScore?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
