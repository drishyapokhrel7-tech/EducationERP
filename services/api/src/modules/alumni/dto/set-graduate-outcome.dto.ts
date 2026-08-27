import { IsBoolean, IsIn, IsOptional, IsString } from "class-validator";

export class SetGraduateOutcomeDto {
  @IsIn(["EMPLOYED", "SELF_EMPLOYED", "FURTHER_STUDY", "UNEMPLOYED_SEEKING", "UNEMPLOYED_NOT_SEEKING", "UNKNOWN"])
  employmentStatus!:
    | "EMPLOYED"
    | "SELF_EMPLOYED"
    | "FURTHER_STUDY"
    | "UNEMPLOYED_SEEKING"
    | "UNEMPLOYED_NOT_SEEKING"
    | "UNKNOWN";

  @IsOptional()
  @IsString()
  employerOrInstitution?: string;

  @IsOptional()
  @IsBoolean()
  fieldRelatedToStudy?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
