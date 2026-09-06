import { IsDateString, IsString } from "class-validator";

export class CreateEnrollmentDto {
  @IsString()
  programId!: string;

  @IsString()
  sectionId!: string;

  @IsString()
  semesterId!: string;

  @IsDateString()
  enrollmentDate!: string;
}
