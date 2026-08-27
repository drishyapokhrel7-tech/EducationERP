import { IsEnum } from "class-validator";
import { AssetStatus } from "@prisma/client";

export class UpdateAssetDto {
  @IsEnum(AssetStatus)
  status!: AssetStatus;
}
