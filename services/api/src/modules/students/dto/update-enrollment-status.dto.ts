import { IsEnum } from "class-validator";
import { EnrollmentStatus } from "@prisma/client";

// "Un-enroll" is a status transition (ACTIVE -> WITHDRAWN), not a
// delete — an enrollment can already be referenced by invoices, fee
// assignments, a transport/hostel allocation, matching this project's
// standing preference for a real state change over deleting a record
// something else still points at.
export class UpdateEnrollmentStatusDto {
  @IsEnum(EnrollmentStatus)
  status!: EnrollmentStatus;
}
