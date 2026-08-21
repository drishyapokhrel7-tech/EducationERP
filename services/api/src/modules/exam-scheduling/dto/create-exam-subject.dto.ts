import { IsInt, IsOptional, IsPositive, IsString } from "class-validator";

export class CreateExamSubjectDto {
  @IsString()
  curriculumSubjectId!: string;

  @IsInt()
  @IsPositive()
  fullMarks!: number;

  @IsInt()
  @IsPositive()
  passMarks!: number;

  // Only set when this subject is delivered online — must belong to
  // the same curriculumSubjectId (validated in the service).
  @IsOptional()
  @IsString()
  questionBankId?: string;
}
