import { IsEnum, IsOptional, IsString } from "class-validator";
import { GatewayDeviceType } from "@prisma/client";

export class RegisterDeviceDto {
  @IsString()
  name!: string;

  @IsEnum(GatewayDeviceType)
  deviceType!: GatewayDeviceType;

  @IsOptional()
  @IsString()
  location?: string;
}
