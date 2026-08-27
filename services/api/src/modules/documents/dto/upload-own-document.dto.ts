import { IsString, MinLength } from "class-validator";

// Self-service — no studentId field: the student is always derived
// server-side from the caller's own linked Student row, never a
// request param (same IDOR-safe-by-construction shape as every other
// self-service write in this project).
export class UploadOwnDocumentDto {
  @IsString()
  @MinLength(1)
  documentType!: string;

  @IsString()
  @MinLength(1)
  fileUrl!: string;
}
