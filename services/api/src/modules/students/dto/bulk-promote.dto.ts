import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsDateString, IsIn, IsOptional, IsString, ValidateNested } from "class-validator";

export type PromotionAction = "PROMOTE" | "RETAIN" | "GRADUATE";

export class BulkPromoteEntryDto {
  @IsString()
  enrollmentId!: string;

  @IsIn(["PROMOTE", "RETAIN", "GRADUATE"])
  action!: PromotionAction;

  // Required for PROMOTE/RETAIN — the cohort the student moves into.
  // Not validated as required here (class-validator can't easily express
  // "required if action is X") — the service checks this per-entry and
  // reports it as a row error, same as the CSV import's own per-row
  // validation style, rather than rejecting the whole batch up front.
  @IsOptional()
  @IsString()
  targetProgramId?: string;

  @IsOptional()
  @IsString()
  targetSemesterId?: string;

  @IsOptional()
  @IsString()
  targetSectionId?: string;

  @IsOptional()
  @IsDateString()
  enrollmentDate?: string;
}

export class BulkPromoteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkPromoteEntryDto)
  entries!: BulkPromoteEntryDto[];
}
