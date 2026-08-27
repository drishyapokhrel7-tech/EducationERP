import { IsDateString, IsEnum } from "class-validator";
import { HostelAttendanceStatus } from "@prisma/client";

export class MarkAttendanceDto {
  @IsDateString()
  date!: string;

  @IsEnum(HostelAttendanceStatus)
  status!: HostelAttendanceStatus;
}
