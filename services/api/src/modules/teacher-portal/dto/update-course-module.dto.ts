import { IsBoolean, IsInt, IsOptional, IsPositive, IsString, MinLength } from "class-validator";

export class UpdateCourseModuleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  sequence?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
