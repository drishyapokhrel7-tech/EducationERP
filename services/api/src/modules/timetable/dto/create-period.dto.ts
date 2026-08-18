import { IsInt, IsPositive, IsString, Matches, MinLength } from "class-validator";

export class CreatePeriodDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  code!: string;

  @IsInt()
  @IsPositive()
  sequence!: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "startTime must be HH:mm 24-hour" })
  startTime!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "endTime must be HH:mm 24-hour" })
  endTime!: string;
}
