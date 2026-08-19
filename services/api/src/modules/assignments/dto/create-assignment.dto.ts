import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsPositive, IsString, MinLength } from "class-validator";
import { SubmissionType } from "@prisma/client";

export class CreateAssignmentDto {
  @IsString()
  teachingAssignmentId!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(SubmissionType)
  submissionType!: SubmissionType;

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
}
