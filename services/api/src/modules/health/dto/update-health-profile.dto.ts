import { IsEnum, IsOptional, IsString } from "class-validator";
import { BloodGroup } from "@prisma/client";

export class UpdateHealthProfileDto {
  @IsOptional()
  @IsEnum(BloodGroup)
  bloodGroup?: BloodGroup;

  @IsOptional()
  @IsString()
  allergies?: string;

  @IsOptional()
  @IsString()
  chronicConditions?: string;

  @IsOptional()
  @IsString()
  currentMedications?: string;

  @IsOptional()
  @IsString()
  emergencyMedicalNotes?: string;
}
