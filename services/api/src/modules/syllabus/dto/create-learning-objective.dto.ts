import { IsInt, IsPositive, IsString, MinLength } from "class-validator";

export class CreateLearningObjectiveDto {
  @IsInt()
  @IsPositive()
  sequence!: number;

  @IsString()
  @MinLength(1)
  description!: string;
}
