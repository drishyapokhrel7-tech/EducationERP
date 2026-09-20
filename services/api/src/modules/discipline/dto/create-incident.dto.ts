import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { DisciplineSeverity } from "@prisma/client";

export class CreateIncidentDto {
  @IsString()
  @MinLength(1)
  incidentType!: string;

  @IsEnum(DisciplineSeverity)
  severity!: DisciplineSeverity;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsOptional()
  @IsString()
  actionTaken?: string;

  @IsDateString()
  incidentDate!: string;
}
