import { IsOptional, IsString, IsUrl, MinLength } from "class-validator";

export class CreateClassMaterialDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
