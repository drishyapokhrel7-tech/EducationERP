import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class CreateOpportunityDto {
  @IsString()
  companyId!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsIn(["JOB", "INTERNSHIP"])
  type!: "JOB" | "INTERNSHIP";

  @IsString()
  @MinLength(1)
  description!: string;

  @IsOptional()
  @IsString()
  location?: string;
}
