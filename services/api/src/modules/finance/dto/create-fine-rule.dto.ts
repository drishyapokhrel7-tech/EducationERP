import { IsEnum, IsNumber, IsPositive, IsString } from "class-validator";
import { FineRuleType } from "@prisma/client";

export class CreateFineRuleDto {
  @IsString()
  feeCategoryId!: string;

  @IsEnum(FineRuleType)
  type!: FineRuleType;

  @IsNumber()
  @IsPositive()
  amount!: number;
}
