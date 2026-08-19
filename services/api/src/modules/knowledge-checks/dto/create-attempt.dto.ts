import { ArrayMinSize, IsArray, IsInt, IsString, Min } from "class-validator";

export class CreateAttemptDto {
  @IsString()
  studentId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  answers!: number[];
}
