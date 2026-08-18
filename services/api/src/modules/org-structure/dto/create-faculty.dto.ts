import { IsString, MinLength } from "class-validator";

export class CreateFacultyDto {
  @IsString()
  campusId!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(1)
  code!: string;
}
