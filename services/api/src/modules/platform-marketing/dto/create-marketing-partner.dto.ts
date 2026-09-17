import { IsEmail, IsNumber, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export class CreateMarketingPartnerDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(3)
  referralCode!: string;

  @IsOptional()
  @IsString()
  payoutAccount?: string;

  // Omitted entirely lets Prisma's own schema default (10.00) apply —
  // not defaulted again here.
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRatePercent?: number;
}
