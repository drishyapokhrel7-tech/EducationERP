import { IsDateString, IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";

export class CreateStudentDto {
  // studentCode is deliberately NOT accepted here — it's generated
  // server-side (sequential "STU-0001", ... per organization, see
  // StudentsService.nextStudentCode), not typed by the caller.
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
  // file-attaching field in this project. Mandatory at the API/UI
  // layer per explicit user request — kept nullable at the DB layer
  // (schema.prisma) so this doesn't need a backfill for any row that
  // predates the requirement.
  @IsString()
  @IsNotEmpty()
  photoUrl!: string;
}
