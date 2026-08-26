import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateLeaveTypeDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  code!: string;

  // 0 is a real value here, not a placeholder — an untracked/unpaid
  // leave type legitimately has no default allocation.
  @IsInt()
  @Min(0)
  defaultDaysPerYear!: number;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @IsBoolean()
  carryForward?: boolean;
}
