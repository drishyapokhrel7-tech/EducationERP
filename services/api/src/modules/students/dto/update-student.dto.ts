import { IsDateString, IsOptional, IsString, MinLength } from "class-validator";

// studentCode is deliberately absent — same reasoning as
// CreateStudentDto: system-generated, never caller-supplied, and
// immutable once assigned (other records already reference it, e.g.
// search-by-code, invoice line items quoting it historically).
export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}
