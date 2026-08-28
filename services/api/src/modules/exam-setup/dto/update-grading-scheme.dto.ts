import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from "class-validator";
import { GradeBandDto } from "./create-grading-scheme.dto";

export class UpdateGradingSchemeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GradeBandDto)
  bands?: GradeBandDto[];
}
