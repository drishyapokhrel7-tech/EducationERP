import { IsInt, IsPositive, IsString, Max, Min } from "class-validator";

export class AllocateLeaveBalanceDto {
  @IsString()
  employeeId!: string;

  @IsString()
  leaveTypeId!: string;

  @IsInt()
  @Min(2000)
  @Max(2200)
  year!: number;

  @IsInt()
  @IsPositive()
  allocatedDays!: number;
}
