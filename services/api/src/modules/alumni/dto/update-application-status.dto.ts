import { IsIn, IsOptional, IsString } from "class-validator";

// Admin-only review transitions. WITHDRAWN is reachable only via the
// applicant's own self-service endpoint, not this one.
export class UpdateApplicationStatusDto {
  @IsIn(["UNDER_REVIEW", "SHORTLISTED", "REJECTED", "ACCEPTED"])
  status!: "UNDER_REVIEW" | "SHORTLISTED" | "REJECTED" | "ACCEPTED";

  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
