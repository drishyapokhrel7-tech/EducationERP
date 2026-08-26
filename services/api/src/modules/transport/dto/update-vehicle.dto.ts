import { IsEnum, IsInt, IsOptional, IsPositive, IsString, MinLength } from "class-validator";
import { VehicleStatus } from "@prisma/client";

export class UpdateVehicleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  type?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  capacity?: number;

  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;
}
