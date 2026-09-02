import { BadRequestException } from "@nestjs/common";
import type { MulterOptions } from "@nestjs/platform-express/multer/interfaces/multer-options.interface";

// Every FileInterceptor in this app was previously unbounded — no
// size cap, no MIME-type check — meaning any authenticated caller
// (down to a student/parent portal login) could upload an arbitrarily
// large or arbitrarily-typed file. Every upload endpoint here uses
// multer's memoryStorage (deliberately, per uploads.controller.ts's
// own comment — files are only ever needed transiently before being
// handed to StorageService or parsed), which buffers the whole file
// in process memory before anything downstream ever gets a chance to
// reject it — so the size cap is a real memory-exhaustion guard, not
// just a storage-quota nicety. Security-hardening pass, Phase 8.
function mimeTypeFilter(allowed: ReadonlySet<string>): MulterOptions["fileFilter"] {
  return (_req, file, callback) => {
    if (!allowed.has(file.mimetype)) {
      callback(new BadRequestException(`Unsupported file type: ${file.mimetype}`), false);
      return;
    }
    callback(null, true);
  };
}

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// A face-enrollment/camera-event photo — always a captured image, so
// a tighter cap than a general document upload.
export const IMAGE_UPLOAD_OPTIONS: MulterOptions = {
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: mimeTypeFilter(IMAGE_MIME_TYPES),
};

// CSV MIME-type detection is notoriously inconsistent across
// browsers/OSes (a .csv file gets sent as text/csv, application/vnd
// .ms-excel, or plain text/plain depending on what sent it) — a
// mislabeled plain-text file carries none of the risk a mislabeled
// binary would, so text/plain is allowed here deliberately, not an
// oversight.
const IMPORT_MIME_TYPES = new Set([
  "text/csv",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

// The student CSV/Excel bulk-import endpoint — a real roster import
// can legitimately be a few MB, so a more generous cap than a photo.
export const IMPORT_UPLOAD_OPTIONS: MulterOptions = {
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: mimeTypeFilter(IMPORT_MIME_TYPES),
};

// The generic organizations/me/uploads endpoint backs everything from
// a student photo to a course material PDF to a certificate scan —
// genuinely broad by design (see uploads.controller.ts's own comment
// on why it's gated by nothing but JwtAuthGuard), so its allowlist
// stays broad too rather than narrowed to one use case.
const GENERAL_MIME_TYPES = new Set([
  ...IMAGE_MIME_TYPES,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ...IMPORT_MIME_TYPES,
]);

export const GENERAL_UPLOAD_OPTIONS: MulterOptions = {
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: mimeTypeFilter(GENERAL_MIME_TYPES),
};
