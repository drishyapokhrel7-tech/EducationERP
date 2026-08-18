import { IsBoolean, IsOptional, IsString } from "class-validator";

export class AttachCurriculumSubjectDto {
  @IsString()
  subjectId!: string;

  @IsOptional()
  @IsBoolean()
  isCompulsory?: boolean;
}
