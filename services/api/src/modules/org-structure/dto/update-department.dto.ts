import { IsOptional, IsString, MinLength } from "class-validator";

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  facultyId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;
}
