import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateExamDto {
  @IsString()
  examTypeId!: string;

  @IsString()
  termId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  gradingSchemeId?: string;
}
