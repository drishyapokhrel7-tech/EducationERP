import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsDateString, IsNumber, IsPositive, ValidateNested } from "class-validator";

class InstallmentInput {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsDateString()
  dueDate!: string;
}

export class CreateInstallmentPlanDto {
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => InstallmentInput)
  installments!: InstallmentInput[];
}
