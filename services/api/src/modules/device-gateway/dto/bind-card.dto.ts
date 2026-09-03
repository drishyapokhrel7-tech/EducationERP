import { IsOptional, IsString, MinLength } from "class-validator";

// Exactly one of studentId/staffId must be set — same XOR-at-the-
// service-layer precedent as CreateFaceEnrollmentDto, not a class-
// validator-level constraint.
export class BindCardDto {
  @IsString()
  @MinLength(1)
  rawCode!: string;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  staffId?: string;
}
