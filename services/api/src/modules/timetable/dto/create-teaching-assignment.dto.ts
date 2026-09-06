import { IsOptional, IsString } from "class-validator";

export class CreateTeachingAssignmentDto {
  @IsString()
  employeeId!: string;

  @IsString()
  subjectId!: string;

  // Optional — some institutions don't subdivide a program+semester
  // into sections. When omitted, programId (below) is required
  // instead, so this assignment still resolves to exactly one
  // program either way.
  @IsOptional()
  @IsString()
  sectionId?: string;

  // Required only when sectionId is omitted — when a section is
  // given, its own programId is authoritative and this field is
  // ignored (validated in TimetableService.createTeachingAssignment).
  @IsOptional()
  @IsString()
  programId?: string;

  @IsString()
  semesterId!: string;
}
