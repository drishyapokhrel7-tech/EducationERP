import { IsInt, Min } from "class-validator";

export class SaveQuizAnswerDto {
  // The position in the shuffled/displayed options array the student
  // clicked. The service translates this back to the question's real
  // option index before storing — same convention as exam-taking's
  // SaveAnswerDto.
  @IsInt()
  @Min(0)
  selectedOptionIndex!: number;
}
