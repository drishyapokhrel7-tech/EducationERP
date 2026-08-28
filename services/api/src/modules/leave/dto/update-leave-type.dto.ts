import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class UpdateLeaveTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  defaultDaysPerYear?: number;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @IsBoolean()
  carryForward?: boolean;
}
