import { IsDateString, IsString, MinLength } from "class-validator";

export class EnrollApplicationDto {
  @IsString()
  @MinLength(1)
  studentCode!: string;

  @IsString()
  sectionId!: string;

  @IsString()
  termId!: string;

  @IsDateString()
  enrollmentDate!: string;
}
