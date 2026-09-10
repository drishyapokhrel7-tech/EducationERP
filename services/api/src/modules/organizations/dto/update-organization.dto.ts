import { IsEmail, IsOptional, IsString, IsUrl } from "class-validator";

// Letterhead metadata for printable documents — every field optional,
// same reasoning as RegisterOrganizationDto.website: none of this is
// required identity like name/slug.
export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  // A storage URL already returned by the generic upload endpoint —
  // same two-step upload flow as Student.photoUrl/Employee.photoUrl,
  // not a dedicated upload pipeline.
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsUrl()
  website?: string;
}
