import { IsBoolean, IsNumber, IsOptional, IsPositive } from "class-validator";

export class UpdateFineRuleDto {
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
