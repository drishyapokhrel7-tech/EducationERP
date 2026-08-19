import { ArrayMinSize, IsArray, IsInt, IsPositive, IsString, Min, MinLength } from "class-validator";

export class CreateQuestionDto {
  @IsInt()
  @IsPositive()
  sequence!: number;

  @IsString()
  @MinLength(1)
  text!: string;

  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  options!: string[];

  @IsInt()
  @Min(0)
  correctOptionIndex!: number;
}
