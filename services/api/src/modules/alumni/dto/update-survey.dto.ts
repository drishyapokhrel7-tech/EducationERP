import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsOptional, IsString, MinLength, ValidateNested } from "class-validator";
import { SurveyQuestionDto } from "./create-survey.dto";

// Only usable while the survey is still DRAFT — editing the question
// set after PUBLISHED is rejected in the service (400), same
// "publish locks the question set" precedent as KnowledgeCheck.
export class UpdateSurveyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SurveyQuestionDto)
  questions?: SurveyQuestionDto[];
}
