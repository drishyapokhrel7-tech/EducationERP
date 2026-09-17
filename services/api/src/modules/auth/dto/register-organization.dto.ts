import { IsEmail, IsOptional, IsString, IsUrl, MinLength } from "class-validator";

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

  // Optional letterhead metadata (Organization.website) — same
  // reasoning as address/phone/email/logoUrl, not required identity.
  @IsOptional()
  @IsUrl()
  website?: string;

  // Optional MarketingPartner.referralCode, matched case-insensitively
  // against an active partner at registration time — see
  // AuthService.registerOrganization. A wrong/unmatched code never
  // blocks signup, it just means no referrer gets attached.
  @IsOptional()
  @IsString()
  referralCode?: string;
}
