import { IsString, MinLength } from "class-validator";

export class AnswerGuardianQuestionDto {
  @IsString()
  @MinLength(1)
  answer!: string;
}
