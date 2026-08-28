import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { CampusType } from "@prisma/client";

export class UpdateCampusDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  // Editing the type does not retroactively seed the college
  // structure/defaults — that only ever happens at create time (see
  // OrganizationsService.createCampus), same "only new records are
  // affected" precedent as the edition-limit enforcement elsewhere.
  @IsOptional()
  @IsEnum(CampusType)
  type?: CampusType;
}
