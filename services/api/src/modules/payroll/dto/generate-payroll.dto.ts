import { IsInt, Max, Min } from "class-validator";

export class GeneratePayrollDto {
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth!: number;

  @IsInt()
  @Min(2000)
  @Max(2200)
  periodYear!: number;
}
