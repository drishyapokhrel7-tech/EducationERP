import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateFeeCategoryDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  code!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
