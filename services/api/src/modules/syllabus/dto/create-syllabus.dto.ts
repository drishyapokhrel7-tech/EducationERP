import { IsOptional, IsString } from "class-validator";

export class CreateSyllabusDto {
  @IsString()
  curriculumSubjectId!: string;

  @IsString()
  termId!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
