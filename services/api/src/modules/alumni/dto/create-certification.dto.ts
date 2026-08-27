import { IsDateString, IsOptional, IsString, IsUrl, MinLength } from "class-validator";

export class CreateCertificationDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  issuingOrganization?: string;

  @IsOptional()
  @IsDateString()
  issuedDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsUrl()
  credentialUrl?: string;
}
