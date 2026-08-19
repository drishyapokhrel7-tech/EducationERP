import { IsDateString, IsOptional, IsString } from "class-validator";

export class CreateClassSessionDto {
  @IsString()
  classScheduleId!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  lessonPlanId?: string;
}
