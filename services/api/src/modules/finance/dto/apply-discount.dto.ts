import { IsNumber, IsPositive, IsString, MinLength } from "class-validator";

export class ApplyDiscountDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  @MinLength(1)
  reason!: string;
}
