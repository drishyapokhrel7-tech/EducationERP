import { IsIn } from "class-validator";

// Admin approve/reject of an alumni-submitted PENDING opportunity.
export class ReviewOpportunityDto {
  @IsIn(["APPROVED", "REJECTED"])
  status!: "APPROVED" | "REJECTED";
}
