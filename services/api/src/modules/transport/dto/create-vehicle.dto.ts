import { IsEnum, IsInt, IsOptional, IsPositive, IsString, MinLength } from "class-validator";
import { VehicleStatus } from "@prisma/client";

export class CreateVehicleDto {
  @IsString()
  @MinLength(1)
  registrationNumber!: string;

  @IsString()
  @MinLength(1)
  type!: string;

  @IsInt()
  @IsPositive()
  capacity!: number;

  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;
}
