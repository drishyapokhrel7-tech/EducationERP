import { IsString, MinLength } from "class-validator";

export class CreateStudentDocumentDto {
  @IsString()
  studentId!: string;

  @IsString()
  @MinLength(1)
  documentType!: string;

  @IsString()
  @MinLength(1)
  fileUrl!: string;
}
