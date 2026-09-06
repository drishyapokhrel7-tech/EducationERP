import { IsInt, IsString, Min, MinLength } from "class-validator";

export class CreateTermExamDto {
  @IsString()
  semesterId!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(1)
  code!: string;

  @IsInt()
  @Min(1)
  sequence!: number;
}
