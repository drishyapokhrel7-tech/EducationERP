import { IsDateString, IsInt, IsString, Min, MinLength } from "class-validator";

export class CreateTermDto {
  @IsString()
  academicYearId!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(1)
  code!: string;

  @IsInt()
  @Min(1)
  sequence!: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
