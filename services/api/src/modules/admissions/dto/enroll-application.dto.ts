import { IsDateString, IsString } from "class-validator";

// studentCode is deliberately absent — generated server-side
// (sequential per organization, same as the direct Students-page
// create path), not supplied by the caller. See
// StudentsService.nextStudentCode's own comment: one rule for how a
// student gets a code, not a different one per creation path.
export class EnrollApplicationDto {
  @IsString()
  sectionId!: string;

  @IsString()
  semesterId!: string;

  @IsDateString()
  enrollmentDate!: string;
}
