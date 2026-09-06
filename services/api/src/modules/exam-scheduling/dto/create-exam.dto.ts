import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateExamDto {
  @IsString()
  examTypeId!: string;

  @IsString()
  termExamId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  gradingSchemeId?: string;
}
