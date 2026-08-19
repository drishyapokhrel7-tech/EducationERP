import { IsEnum, IsInt, IsOptional, IsPositive, IsString, MinLength } from "class-validator";
import { SyllabusNodeLevel } from "@prisma/client";

export class CreateSyllabusNodeDto {
  @IsOptional()
  @IsString()
  parentId?: string;

  @IsEnum(SyllabusNodeLevel)
  level!: SyllabusNodeLevel;

  @IsInt()
  @IsPositive()
  sequence!: number;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
