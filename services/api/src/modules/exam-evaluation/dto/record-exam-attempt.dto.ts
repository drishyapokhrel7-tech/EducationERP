import { IsEnum, IsString } from "class-validator";
import { AttendanceStatus } from "@prisma/client";

export class RecordExamAttemptDto {
  @IsString()
  studentId!: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;
}
