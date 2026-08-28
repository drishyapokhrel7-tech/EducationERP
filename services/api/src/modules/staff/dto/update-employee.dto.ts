import { IsDateString, IsEmail, IsOptional, IsString, MinLength } from "class-validator";

// employeeCode is deliberately excluded — the portal-login username
// (${orgSlug}.${employeeCode}) is a real, stored value fixed at
// createLogin time, not recomputed afterward, so allowing the code to
// change post-login would silently desync it from the code an admin
// sees on this record. Same "identifying codes are set once"
// precedent as Student's own studentCode.
export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  staffTypeId?: string;

  @IsOptional()
  @IsString()
  designationId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsDateString()
  dateOfJoining?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}
