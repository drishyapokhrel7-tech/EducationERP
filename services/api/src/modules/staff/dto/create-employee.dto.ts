import { IsDateString, IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";

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

  @IsOptional()
  @IsString()
  middleName?: string;

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
  // CreateStudentDto.photoUrl — see that field's comment. Mandatory
  // for the same reason (explicit user request).
  @IsString()
  @IsNotEmpty()
  photoUrl!: string;
}
