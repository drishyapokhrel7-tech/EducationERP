import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class UpdateClassScheduleDto {
  @IsOptional()
  @IsString()
  teachingAssignmentId?: string;

  @IsOptional()
  @IsString()
  roomId?: string;

  @IsOptional()
  @IsString()
  periodId?: string;

  // 1=Monday .. 7=Sunday (ISO 8601)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek?: number;
}
