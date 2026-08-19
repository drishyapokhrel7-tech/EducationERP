import { IsDateString, IsOptional, IsString, MinLength } from "class-validator";

export class CreateLessonPlanDto {
  @IsString()
  teachingAssignmentId!: string;

  @IsString()
  syllabusNodeId!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  objectives!: string;

  @IsOptional()
  @IsString()
  materials?: string;

  @IsOptional()
  @IsDateString()
  plannedDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
