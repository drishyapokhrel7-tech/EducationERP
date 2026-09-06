import { IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class UpdateTermExamDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  sequence?: number;
}
