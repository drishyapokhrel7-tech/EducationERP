import { IsDateString, IsOptional, IsString, MinLength } from "class-validator";

export class CreateStudentDto {
  @IsString()
  @MinLength(1)
  studentCode!: string;

  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsOptional()
  @IsString()
  gender?: string;

  // A storage URL already returned by the generic upload endpoint
  // (`POST .../uploads`, LMS discovery slice 8) — the form uploads the
  // file (or a captured camera frame) first, then submits the
  // resulting url here, same two-step flow as every other
  // file-attaching field in this project.
  @IsOptional()
  @IsString()
  photoUrl?: string;
}
