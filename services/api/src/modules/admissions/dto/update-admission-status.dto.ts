import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { AdmissionStatus } from "@prisma/client";

// ENROLLED is deliberately not settable here — it can only be reached
// through the enroll action, which needs a section/term/student code
// this endpoint doesn't have and creates real Student/Enrollment rows
// as a side effect, not just a status flip.
const SETTABLE_STATUSES = [
  AdmissionStatus.SUBMITTED,
  AdmissionStatus.UNDER_REVIEW,
  AdmissionStatus.INTERVIEW_SCHEDULED,
  AdmissionStatus.APPROVED,
  AdmissionStatus.REJECTED,
] as const;

export class UpdateAdmissionStatusDto {
  @IsEnum(SETTABLE_STATUSES)
  status!: (typeof SETTABLE_STATUSES)[number];

  @IsOptional()
  @IsString()
  reason?: string;

  @IsDateString()
  effectiveDate!: string;
}
