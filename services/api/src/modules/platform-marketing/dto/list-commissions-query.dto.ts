import { CommissionStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class ListCommissionsQueryDto {
  @IsOptional()
  @IsEnum(CommissionStatus)
  status?: CommissionStatus;

  @IsOptional()
  @IsString()
  partnerId?: string;
}
