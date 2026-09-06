import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsNumber, IsPositive, IsString, MinLength, ValidateNested } from "class-validator";

export class FeeStructureItemDto {
  @IsString()
  feeCategoryId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;
}

export class CreateFeeStructureDto {
  @IsString()
  programId!: string;

  @IsString()
  semesterId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FeeStructureItemDto)
  items!: FeeStructureItemDto[];
}
