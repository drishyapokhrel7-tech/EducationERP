import { IsInt, IsOptional, IsPositive, IsString, MinLength } from "class-validator";

export class CreateCourseModuleDto {
  @IsString()
  teachingAssignmentId!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @IsPositive()
  sequence!: number;
}
