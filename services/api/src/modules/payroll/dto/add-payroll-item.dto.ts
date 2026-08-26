import { IsEnum, IsNumber, IsPositive, IsString, MinLength } from "class-validator";
import { PayrollItemType } from "@prisma/client";

export class AddPayrollItemDto {
  @IsEnum(PayrollItemType)
  type!: PayrollItemType;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;
}
