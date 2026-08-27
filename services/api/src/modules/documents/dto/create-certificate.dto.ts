import { IsString, MinLength } from "class-validator";

export class CreateCertificateDto {
  @IsString()
  studentId!: string;

  @IsString()
  @MinLength(1)
  type!: string;

  @IsString()
  @MinLength(1)
  fileUrl!: string;
}
