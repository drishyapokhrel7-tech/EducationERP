import { IsOptional, IsString } from "class-validator";

export class AssignAssetDto {
  @IsString()
  assetId!: string;

  @IsString()
  employeeId!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
