import { IsOptional, IsString } from "class-validator";

export class CreateSubmissionDto {
  @IsString()
  studentId!: string;

  @IsOptional()
  @IsString()
  content?: string;
}
