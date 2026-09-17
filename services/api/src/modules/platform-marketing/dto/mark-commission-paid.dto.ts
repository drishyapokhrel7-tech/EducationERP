import { IsOptional, IsString } from "class-validator";

export class MarkCommissionPaidDto {
  @IsOptional()
  @IsString()
  note?: string;
}
