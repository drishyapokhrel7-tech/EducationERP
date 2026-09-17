import { IsBoolean, IsEmail, IsNumber, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

// referralCode is deliberately absent — locked at creation. Partners
// share links like /register?ref=CODE; allowing an edit here would
// silently break any link already shared, with no error surfaced to
// anyone. If a code is wrong, delete and recreate the partner.
export class UpdateMarketingPartnerDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  payoutAccount?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRatePercent?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
