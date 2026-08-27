import { IsInt, IsOptional, IsString, MinLength } from "class-validator";

export class CreateEducationDto {
  @IsString()
  @MinLength(1)
  institutionName!: string;

  @IsString()
  @MinLength(1)
  degree!: string;

  @IsOptional()
  @IsString()
  fieldOfStudy?: string;

  @IsOptional()
  @IsInt()
  startYear?: number;

  @IsOptional()
  @IsInt()
  endYear?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
