import { IsInt, IsOptional, IsPositive, IsString, MinLength } from "class-validator";

export class CreateSectionDto {
  @IsString()
  programId!: string;

  @IsString()
  semesterId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  code!: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  capacity?: number;
}
