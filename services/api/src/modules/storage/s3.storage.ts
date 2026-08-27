import { randomUUID } from "crypto";
import { extname } from "path";
import { Injectable } from "@nestjs/common";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { StorageDriver, StoredFile, UploadedFileInput } from "./storage.types";

// Speaks the plain S3 API, which real AWS S3 and every S3-compatible
// object store (Cloudflare R2, Backblaze B2, MinIO, DigitalOcean
// Spaces, ...) all implement — S3_ENDPOINT is what actually selects
// which one: omit it for real AWS S3, set it to point anywhere else.
// This is the durable option for a serverless deployment (Vercel),
// where LocalDiskStorageDriver's filesystem writes don't survive.
@Injectable()
export class S3StorageDriver implements StorageDriver {
  private readonly client = new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT,
    // Path-style addressing is what most non-AWS S3-compatible
    // endpoints expect; real AWS S3 works fine either way but defaults
    // to virtual-hosted style when no custom endpoint is set.
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });
  private readonly bucket = process.env.S3_BUCKET ?? "";
  private readonly publicBaseUrl = process.env.S3_PUBLIC_BASE_URL ?? "";

  async upload(organizationId: string, file: UploadedFileInput): Promise<StoredFile> {
    const key = `${organizationId}/${randomUUID()}${extname(file.originalName)}`;
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: file.buffer, ContentType: file.mimetype }),
    );
    return { key, url: `${this.publicBaseUrl}/${key}` };
  }
}
