import { IsNumber, IsOptional, IsPositive, IsString, Max, MinLength } from "class-validator";

// Exactly one of percentage/amount is expected — enforced in the
// service (a structural rule, not just formatting), same XOR pattern
// as FaceEnrollment's studentId/staffId.
export class CreateScholarshipDto {
  @IsString()
  @MinLength(1)
  name!: string;

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
