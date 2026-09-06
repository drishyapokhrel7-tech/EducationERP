import { IsDateString, IsOptional, IsString } from "class-validator";

export class CreateEnrollmentDto {
  @IsString()
  programId!: string;

  // Optional — some institutions don't subdivide a program+semester
  // into sections at all.
  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsString()
  semesterId!: string;

  @IsDateString()
  enrollmentDate!: string;
}
