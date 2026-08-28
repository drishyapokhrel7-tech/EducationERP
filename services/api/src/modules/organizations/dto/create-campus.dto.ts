import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { CampusType } from "@prisma/client";

export class CreateCampusDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(1)
  code!: string;

  // Defaults to GENERIC in the service when omitted — COLLEGE is the
  // one value that drives real behavior (see
  // OrgStructureService's seedCollegeStructure).
  @IsOptional()
  @IsEnum(CampusType)
  type?: CampusType;
}
