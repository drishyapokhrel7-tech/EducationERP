import { IsEnum, IsOptional, IsString } from "class-validator";
import { CameraAdapterType } from "@prisma/client";

export class CreateCameraDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsEnum(CameraAdapterType)
  adapterType?: CameraAdapterType;
}
