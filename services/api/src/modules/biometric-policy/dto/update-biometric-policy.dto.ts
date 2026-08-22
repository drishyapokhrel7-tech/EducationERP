import { IsBoolean, IsInt, IsNumber, IsOptional, Max, Min } from "class-validator";

export class UpdateBiometricPolicyDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  retentionDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  matchConfidenceThreshold?: number;
}
