import { IsDateString, IsOptional, IsString } from "class-validator";

export class CreateFaceEnrollmentDto {
  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  staffId?: string;

  @IsString()
  consentGivenBy!: string;

  @IsOptional()
  @IsDateString()
  consentGivenAt?: string;
}
