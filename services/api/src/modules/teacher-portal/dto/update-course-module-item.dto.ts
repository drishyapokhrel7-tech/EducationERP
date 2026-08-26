import { IsBoolean, IsInt, IsOptional, IsPositive, IsString, MinLength } from "class-validator";

export class UpdateCourseModuleItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  content?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  sequence?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
