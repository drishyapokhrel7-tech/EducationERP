import { IsOptional, IsString, MinLength } from "class-validator";

export class UpdateBookCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;
}
