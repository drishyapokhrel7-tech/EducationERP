import { IsDateString, IsEnum, IsNumber, IsOptional, IsPositive, IsString } from "class-validator";
import { PaymentMethod } from "@prisma/client";

export class RecordPaymentDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
