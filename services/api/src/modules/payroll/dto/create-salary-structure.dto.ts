import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsEnum, IsNumber, IsOptional, IsPositive, IsString, Max, MinLength, ValidateNested } from "class-validator";
import { PayrollItemType } from "@prisma/client";

// Exactly one of amount/percentOfBasic is expected — enforced in the
// service (a structural rule, not just formatting), same XOR pattern as
// Scholarship's percentage/amount-exclusive rule (7a-1).
export class SalaryStructureItemDto {
  @IsEnum(PayrollItemType)
  type!: PayrollItemType;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(100)
  percentOfBasic?: number;
}

export class CreateSalaryStructureDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsNumber()
  @IsPositive()
  basicSalary!: number;

  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => SalaryStructureItemDto)
  items!: SalaryStructureItemDto[];
}
