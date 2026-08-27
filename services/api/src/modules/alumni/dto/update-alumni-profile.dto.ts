import { IsBoolean, IsOptional, IsString, IsUrl } from "class-validator";

export class UpdateAlumniProfileDto {
  @IsOptional()
  @IsString()
  currentOccupation?: string;

  @IsOptional()
  @IsString()
  currentEmployer?: string;

  @IsOptional()
  @IsString()
  currentLocation?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsUrl()
  linkedinUrl?: string;

  @IsOptional()
  @IsBoolean()
  isPubliclyVisible?: boolean;
}
