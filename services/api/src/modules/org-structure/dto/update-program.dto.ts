import { IsInt, IsOptional, IsPositive, IsString, MinLength } from "class-validator";

export class UpdateProgramDto {
  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  durationSemesters?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  creditHours?: number;

  @IsOptional()
  @IsString()
  entranceExam?: string;
}
