import { IsString, MinLength } from "class-validator";

export class CreateDepartmentDto {
  @IsString()
  facultyId!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(1)
  code!: string;
}
