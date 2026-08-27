import { IsInt, IsOptional, IsString, IsUrl, Min } from "class-validator";

export class CreateAlumniProfileDto {
  @IsString()
  studentId!: string;

  @IsInt()
  @Min(1900)
  graduationYear!: number;

  @IsOptional()
  @IsString()
  currentOccupation?: string;

  @IsOptional()
  @IsString()
  currentEmployer?: string;

  @IsOptional()
  @IsString()
  currentLocation?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsUrl()
  linkedinUrl?: string;
}
