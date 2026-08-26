import { IsDateString, IsOptional, IsString } from "class-validator";

export class CreateLeaveRequestDto {
  @IsString()
  employeeId!: string;

  @IsString()
  leaveTypeId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
