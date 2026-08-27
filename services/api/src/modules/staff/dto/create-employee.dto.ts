import { IsDateString, IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class CreateEmployeeDto {
  @IsString()
  staffTypeId!: string;

  @IsString()
  designationId!: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsString()
  @MinLength(1)
  employeeCode!: string;

  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsDateString()
  dateOfJoining!: string;

  // Same generic-storage-URL two-step upload flow as
  // CreateStudentDto.photoUrl — see that field's comment.
  @IsOptional()
  @IsString()
  photoUrl?: string;
}
