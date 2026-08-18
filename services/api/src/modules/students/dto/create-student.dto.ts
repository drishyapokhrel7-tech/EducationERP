import { IsDateString, IsOptional, IsString, MinLength } from "class-validator";

export class CreateStudentDto {
  @IsString()
  @MinLength(1)
  studentCode!: string;

  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsOptional()
  @IsString()
  gender?: string;
}
