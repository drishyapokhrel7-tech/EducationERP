import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { StudentStatus } from "@prisma/client";

export class UpdateStudentStatusDto {
  @IsEnum(StudentStatus)
  status!: StudentStatus;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsDateString()
  effectiveDate!: string;
}
