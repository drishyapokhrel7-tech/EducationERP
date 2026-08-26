import { IsOptional, IsString } from "class-validator";

export class SubmitAssignmentDto {
  // No studentId — the caller's own Student row is derived server-side.
  // Text or a link, matching AssignmentSubmission's own "no file
  // upload" precedent (see the schema's comment on why).
  @IsOptional()
  @IsString()
  content?: string;
}
