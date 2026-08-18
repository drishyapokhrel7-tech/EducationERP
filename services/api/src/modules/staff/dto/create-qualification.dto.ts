import { IsInt, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export class CreateQualificationDto {
  @IsString()
  @MinLength(1)
  degree!: string;

  @IsString()
  @MinLength(1)
  institution!: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  yearCompleted?: number;
}
