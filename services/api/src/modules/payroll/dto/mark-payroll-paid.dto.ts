import { IsEnum } from "class-validator";
import { PaymentMethod } from "@prisma/client";

export class MarkPayrollPaidDto {
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;
}
