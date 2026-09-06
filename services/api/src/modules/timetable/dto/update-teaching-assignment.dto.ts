import { IsOptional, IsString } from "class-validator";

export class UpdateTeachingAssignmentDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  // Only meaningful together with sectionId (see
  // TimetableService.updateTeachingAssignment) — there's no way to
  // clear an assignment back to section-less via update, same as
  // every other field here: absence means "leave as-is," not "clear."
  @IsOptional()
  @IsString()
  programId?: string;

  @IsOptional()
  @IsString()
  semesterId?: string;
}
