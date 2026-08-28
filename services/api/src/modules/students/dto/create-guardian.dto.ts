import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";

export class CreateGuardianDto {
  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsString()
  @MinLength(1)
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  occupation?: string;

  // Same generic-storage-URL two-step upload flow as
  // CreateStudentDto.photoUrl — see that field's comment. Mandatory
  // for the same reason (explicit user request).
  @IsString()
  @IsNotEmpty()
  photoUrl!: string;
}
