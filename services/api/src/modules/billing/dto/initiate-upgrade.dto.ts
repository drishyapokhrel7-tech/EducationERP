import { IsIn } from "class-validator";
import { Edition } from "@prisma/client";

export class InitiateUpgradeDto {
  // FREE is never a valid upgrade target — there's nothing to pay
  // for. Validated as a plain allow-list rather than @IsEnum(Edition)
  // for exactly this reason: the DTO itself should reject FREE, not
  // just the service logic downstream.
  @IsIn(["PROFESSIONAL", "ULTRA"] satisfies Edition[])
  targetEdition!: "PROFESSIONAL" | "ULTRA";
}
