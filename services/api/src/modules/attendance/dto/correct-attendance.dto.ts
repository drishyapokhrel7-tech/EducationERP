import { IsEnum, IsString, MinLength } from "class-validator";
import { AttendanceStatus } from "@prisma/client";

export class CorrectAttendanceDto {
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsString()
  @MinLength(1)
  reason!: string;
}
