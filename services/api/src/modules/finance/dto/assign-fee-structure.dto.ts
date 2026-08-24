import { IsDateString, IsString } from "class-validator";

export class AssignFeeStructureDto {
  @IsString()
  studentEnrollmentId!: string;

  @IsDateString()
  dueDate!: string;
}

export class AssignFeeStructureBulkDto {
  @IsDateString()
  dueDate!: string;
}
