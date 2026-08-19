import { IsInt, IsOptional, IsPositive, IsString, MinLength } from "class-validator";

export class CreateKnowledgeCheckDto {
  @IsString()
  teachingAssignmentId!: string;

  @IsOptional()
  @IsString()
  syllabusNodeId?: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  durationMinutes?: number;
}
