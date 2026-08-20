import { QuestionType } from "@prisma/client";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

export class CreateQuestionDto {
  @IsInt()
  @IsPositive()
  sequence!: number;

  @IsString()
  @MinLength(1)
  text!: string;

  @IsEnum(QuestionType)
  questionType!: QuestionType;

  @IsInt()
  @IsPositive()
  marks!: number;

  // Required for OBJECTIVE, must be absent for SUBJECTIVE — enforced in
  // the service (a structural rule, not just a formatting one), same
  // discipline as KnowledgeCheck's publish gating.
  @ValidateIf((dto: CreateQuestionDto) => dto.questionType === QuestionType.OBJECTIVE)
  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  options?: string[];

  @ValidateIf((dto: CreateQuestionDto) => dto.questionType === QuestionType.OBJECTIVE)
  @IsInt()
  @Min(0)
  correctOptionIndex?: number;

  @IsOptional()
  @IsString()
  modelAnswer?: string;
}
