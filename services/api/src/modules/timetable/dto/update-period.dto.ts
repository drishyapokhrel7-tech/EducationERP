import { IsInt, IsOptional, IsPositive, IsString, Matches, MinLength } from "class-validator";

export class UpdatePeriodDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  sequence?: number;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "startTime must be HH:mm 24-hour" })
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "endTime must be HH:mm 24-hour" })
  endTime?: string;
}
