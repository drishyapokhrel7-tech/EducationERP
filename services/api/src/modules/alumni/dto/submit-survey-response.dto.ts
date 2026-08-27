import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsString, MinLength, ValidateNested } from "class-validator";

export class SurveyAnswerDto {
  @IsString()
  @MinLength(1)
  questionId!: string;

  // Kept as a plain string — a RATING answer is sent as "4", a
  // SINGLE_CHOICE answer as the chosen option text. No numeric type
  // coercion here since the service doesn't compute anything from
  // answers yet (aggregate reporting is Phase 8's separate Analytics
  // slice, 8d).
  @IsString()
  value!: string;
}

export class SubmitSurveyResponseDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SurveyAnswerDto)
  answers!: SurveyAnswerDto[];
}
