import { IsDateString, IsString, Matches } from "class-validator";

export class CreateExamScheduleDto {
  @IsDateString()
  date!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "startTime must be HH:mm 24-hour" })
  startTime!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "endTime must be HH:mm 24-hour" })
  endTime!: string;
}
