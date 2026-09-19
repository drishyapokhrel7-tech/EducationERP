import { IsDateString, IsOptional, IsString } from "class-validator";

export class CreateSubstituteAssignmentDto {
  @IsString()
  classScheduleId!: string;

  @IsDateString()
  date!: string;

  @IsString()
  substituteEmployeeId!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
