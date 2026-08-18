import { IsEmail, IsString, MinLength } from "class-validator";

export class RegisterOrganizationDto {
  @IsString()
  @MinLength(2)
  organizationName!: string;

  @IsString()
  @MinLength(2)
  slug!: string;

  @IsEmail()
  adminEmail!: string;

  @IsString()
  @MinLength(2)
  adminFirstName!: string;

  @IsString()
  @MinLength(2)
  adminLastName!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
