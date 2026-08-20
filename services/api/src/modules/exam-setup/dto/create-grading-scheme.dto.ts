import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class GradeBandDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  minPercentage!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  maxPercentage!: number;

  @IsString()
  @MinLength(1)
  grade!: string;

  @IsOptional()
  @IsNumber()
  gpa?: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class CreateGradingSchemeDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  code!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GradeBandDto)
  bands!: GradeBandDto[];
}
