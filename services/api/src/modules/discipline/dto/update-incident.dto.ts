import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { DisciplineSeverity } from "@prisma/client";

export class UpdateIncidentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  incidentType?: string;

  @IsOptional()
  @IsEnum(DisciplineSeverity)
  severity?: DisciplineSeverity;

  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

  @IsOptional()
  @IsString()
  actionTaken?: string;

  @IsOptional()
  @IsDateString()
  incidentDate?: string;
}
