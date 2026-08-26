import { IsDateString, IsString, MinLength } from "class-validator";

export class CreateDriverDto {
  @IsString()
  employeeId!: string;

  @IsString()
  @MinLength(1)
  licenseNumber!: string;

  @IsDateString()
  licenseExpiry!: string;
}
