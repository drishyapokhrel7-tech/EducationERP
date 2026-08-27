import { BadRequestException, Injectable } from "@nestjs/common";
import { LocalDiskStorageDriver } from "./local-disk.storage";
import { S3StorageDriver } from "./s3.storage";
import type { StorageDriver, StoredFile, UploadedFileInput } from "./storage.types";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB — a plain, generous ceiling; no chunked/resumable upload is built for anything larger.

// Allowlist, not a denylist — the same "reject anything we didn't
// explicitly decide to accept" posture as everywhere else this
// project validates input, since this is the one place in the app
// that accepts arbitrary bytes from a request body rather than typed
// JSON fields.
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "video/mp4",
  "video/webm",
]);

/**
 * The "make storage configurable" piece: STORAGE_DRIVER picks the
 * backend ("local" default, or "s3" for any S3-compatible endpoint)
 * once at startup, and nothing else in this app — the uploads
 * endpoint, or any future caller — ever needs to know or care which
 * one is actually storing the bytes. Every attachment field this
 * project already has (ClassMaterial.url, CourseModuleItem.content,
 * AssignmentSubmission.content) keeps its existing "just a URL
 * string" shape — this service is only ever what *produces* that URL
 * when the source is a real upload instead of a pasted external link.
 */
@Injectable()
export class StorageService {
  private readonly driver: StorageDriver =
    process.env.STORAGE_DRIVER === "s3" ? new S3StorageDriver() : new LocalDiskStorageDriver();

  async upload(organizationId: string, file: UploadedFileInput): Promise<StoredFile> {
    if (file.buffer.length === 0) {
      throw new BadRequestException("The uploaded file is empty");
    }
    if (file.buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException("File exceeds the 20MB upload limit");
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }
    return this.driver.upload(organizationId, file);
  }
}
