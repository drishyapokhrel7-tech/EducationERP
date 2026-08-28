import { IsDateString, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateDriverDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  licenseNumber?: string;

  @IsOptional()
  @IsDateString()
  licenseExpiry?: string;
}
