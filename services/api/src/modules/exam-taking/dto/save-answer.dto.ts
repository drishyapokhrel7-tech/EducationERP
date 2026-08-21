import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class SaveAnswerDto {
  // The position in the shuffled/displayed options array the student
  // clicked — OBJECTIVE only. The service translates this back to the
  // question's real option index before storing (see shuffle.ts).
  @IsOptional()
  @IsInt()
  @Min(0)
  selectedOptionIndex?: number;

  // SUBJECTIVE only.
  @IsOptional()
  @IsString()
  textAnswer?: string;
}
