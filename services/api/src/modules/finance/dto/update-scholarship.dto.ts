import { IsNumber, IsOptional, IsPositive, IsString, Max, MinLength } from "class-validator";

// Unlike CreateScholarshipDto, the XOR between percentage/amount is NOT
// re-enforced here — that's a create-time structural rule about which
// reduction mode a scholarship is born with; an update leaves both
// fields optional and simply overwrites whichever are supplied.
export class UpdateScholarshipDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(100)
  percentage?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;
}
