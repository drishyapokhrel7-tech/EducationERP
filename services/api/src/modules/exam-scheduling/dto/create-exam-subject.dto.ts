import { IsInt, IsPositive, IsString } from "class-validator";

export class CreateExamSubjectDto {
  @IsString()
  curriculumSubjectId!: string;

  @IsInt()
  @IsPositive()
  fullMarks!: number;

  @IsInt()
  @IsPositive()
  passMarks!: number;
}
