import { IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { Edition } from "@prisma/client";

export class SubmitUpgradeRequestDto {
  // Same FREE-excluding allow-list as InitiateUpgradeDto.
  @IsIn(["PROFESSIONAL", "ULTRA"] satisfies Edition[])
  targetEdition!: "PROFESSIONAL" | "ULTRA";

  @IsString()
  @IsNotEmpty()
  contactPhone!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
