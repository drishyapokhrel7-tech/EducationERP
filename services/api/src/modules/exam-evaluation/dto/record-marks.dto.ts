import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class RecordMarksDto {
  @IsInt()
  @Min(0)
  obtainedMarks!: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}
