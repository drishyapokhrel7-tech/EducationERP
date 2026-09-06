import { IsInt, IsOptional, IsPositive, IsString, MinLength } from "class-validator";

export class UpdateSectionDto {
  @IsOptional()
  @IsString()
  programId?: string;

  @IsOptional()
  @IsString()
  semesterId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  capacity?: number;
}
