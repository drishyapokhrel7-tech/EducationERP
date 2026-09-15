import { IsOptional, IsString } from "class-validator";

// Staff-initiated, on behalf of a borrower — exactly one of
// studentId/employeeId must be set, same inline check as IssueBookDto.
// The self-service equivalent (a student reserving for themselves) is
// LibraryPortalService.createReservation, which forces studentId from
// the JWT instead of trusting a body param.
export class CreateReservationDto {
  @IsString()
  bookId!: string;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;
}
