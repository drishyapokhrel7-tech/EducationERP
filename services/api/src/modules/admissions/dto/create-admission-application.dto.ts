import { IsDateString, IsNumber, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export class CreateAdmissionApplicationDto {
  @IsString()
  programId!: string;

  @IsString()
  @MinLength(1)
  applicantFirstName!: string;

  @IsString()
  @MinLength(1)
  applicantLastName!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  guardianName?: string;

  @IsOptional()
  @IsString()
  guardianPhone?: string;

  @IsDateString()
  appliedDate!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  score?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
