import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateQuestionBankDto {
  @IsString()
  curriculumSubjectId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
