import { IsIn, IsNumber, IsOptional, IsPositive, IsString } from "class-validator";
import { LibraryFineReason } from "@prisma/client";

// A manual, staff-initiated fine (lost/damaged) — distinct from the
// automatic LATE_RETURN fine LibraryService.returnBook writes on its
// own. Exactly one of studentId/employeeId must be set (same inline
// check as IssueBookDto); transactionId is optional context (e.g. a
// damaged book reported at return time) but not required, since a lost
// book might be reported outside any single transaction.
export class CreateFineDto {
  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsIn(["LOST", "DAMAGED"])
  reason!: Extract<LibraryFineReason, "LOST" | "DAMAGED">;

  @IsNumber()
  @IsPositive()
  amount!: number;
}
