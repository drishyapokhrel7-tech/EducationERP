import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { StaffAttendanceStatus } from "@prisma/client";

export class CreateStaffAttendanceDto {
  @IsString()
  employeeId!: string;

  @IsDateString()
  date!: string;

  @IsEnum(StaffAttendanceStatus)
  status!: StaffAttendanceStatus;

  @IsOptional()
  @IsString()
  remarks?: string;
}
