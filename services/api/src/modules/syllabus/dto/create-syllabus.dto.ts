import { IsOptional, IsString } from "class-validator";

export class CreateSyllabusDto {
  @IsString()
  curriculumSubjectId!: string;

  @IsString()
  semesterId!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
