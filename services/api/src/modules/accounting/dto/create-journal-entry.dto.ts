import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

class JournalLineInput {
  @IsString()
  accountId!: string;

  // Exactly one of debit/credit must be > 0 — validated in the
  // service (not expressible cleanly as a class-validator decorator
  // pair), same "generic-but-specific" error style as
  // CreateInstallmentPlanDto's own sum check.
  @IsOptional()
  @IsNumber()
  @Min(0)
  debit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  credit?: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateJournalEntryDto {
  @IsDateString()
  date!: string;

  @IsString()
  @MinLength(1)
  memo!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalLineInput)
  lines!: JournalLineInput[];
}

export class LedgerQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class AsOfQueryDto {
  @IsOptional()
  @IsDateString()
  asOf?: string;
}

export class PeriodQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
