import { IsBoolean, IsOptional, IsString } from "class-validator";

// Exactly one of studentId/employeeId must be set — validated in
// LibraryService.issueBook, same inline "!a === !b" check precedent as
// BiometricPolicyService.createEnrollment, not a custom class-validator
// decorator.
export class IssueBookDto {
  @IsString()
  bookId!: string;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  // A client-captured frame, base64 (data-URL prefix stripped by the
  // service) — optional, verification is opt-in per issue, never
  // required. Reuses this ERP's own Phase 6 biometric infrastructure
  // (BiometricPolicy/FaceEnrollment/AiGatewayService), not a new
  // face-recognition stack.
  @IsOptional()
  @IsString()
  faceImageBase64?: string;

  // Required to proceed when faceImageBase64 was provided but
  // verification didn't come back MATCHED (camera/AI service
  // unreachable, no enrolled template, or a genuine mismatch) — same
  // "never a hard block, but never silent either" precedent as
  // librarysystem's own Phase 6 (this module's feature reference).
  @IsOptional()
  @IsBoolean()
  manualOverride?: boolean;
}
