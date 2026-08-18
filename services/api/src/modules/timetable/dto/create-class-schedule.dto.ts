import { IsInt, IsString, Max, Min } from "class-validator";

export class CreateClassScheduleDto {
  @IsString()
  teachingAssignmentId!: string;

  @IsString()
  roomId!: string;

  @IsString()
  periodId!: string;

  // 1=Monday .. 7=Sunday (ISO 8601)
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek!: number;
}
