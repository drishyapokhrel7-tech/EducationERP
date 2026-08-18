import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateProgramDto {
  @IsString()
  departmentId!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(1)
  code!: string;

  @IsOptional()
  @IsString()
  level?: string;
}
