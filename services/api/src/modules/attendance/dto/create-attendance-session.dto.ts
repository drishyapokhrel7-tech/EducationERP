import { IsDateString, IsString } from "class-validator";

export class CreateAttendanceSessionDto {
  @IsString()
  classScheduleId!: string;

  @IsDateString()
  date!: string;
}
