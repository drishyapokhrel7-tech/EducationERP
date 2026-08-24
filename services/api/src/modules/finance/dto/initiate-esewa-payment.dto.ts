import { IsNumber, IsPositive } from "class-validator";

export class InitiateEsewaPaymentDto {
  @IsNumber()
  @IsPositive()
  amount!: number;
}
