import { randomUUID } from "crypto";
import { extname } from "path";
import { Injectable } from "@nestjs/common";
import { google } from "googleapis";
import type { StorageDriver, StoredFile, UploadedFileInput } from "./storage.types";
import { Readable } from "stream";

// Third storage backend, alongside local disk and S3 (Phase 7h —
// Documents & Certificates). One Google Drive account, connected
// once via the OAuth refresh token obtained by
// scripts/google-drive-get-refresh-token.js, stores every
// organization's documents — files are named
// "{organizationId}-{uuid}{ext}" for identifiability in the Drive UI
// itself, since Drive has no real path-prefix concept the way S3's
// flat key namespace does. Uses the narrow `drive.file` scope (the
// app can only see/manage files it creates, nothing else already in
// the account), and sets each uploaded file to "anyone with the
// link can view" right after upload so the returned url works the
// same way LocalDiskStorageDriver's and S3StorageDriver's already
// do — a plain, directly-usable link, no further auth needed by
// whatever embeds it (ClassMaterial.url, AssignmentSubmission.content,
// the future Document model, ...).
@Injectable()
export class GoogleDriveStorageDriver implements StorageDriver {
  private readonly folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || undefined;
  private readonly drive = (() => {
    // setCredentials() mutates the client and returns void — it must
    // be its own statement, not chained off `new`, or `auth` below
    // silently ends up undefined (a real bug caught here before it
    // ever ran, not after).
    const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return google.drive({ version: "v3", auth });
  })();

  async upload(organizationId: string, file: UploadedFileInput): Promise<StoredFile> {
    const key = `${organizationId}-${randomUUID()}${extname(file.originalName)}`;

    const created = await this.drive.files.create({
      requestBody: { name: key, parents: this.folderId ? [this.folderId] : undefined },
      media: { mimeType: file.mimetype, body: Readable.from(file.buffer) },
      fields: "id, webContentLink, webViewLink",
    });

    const fileId = created.data.id;
    if (!fileId) throw new Error("Google Drive did not return a file id after upload");

    await this.drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
    });

    // webContentLink (a direct-download link) is preferred since every
    // existing consumer of a stored url treats it as a plain link, not
    // something to render inside Drive's own viewer chrome;
    // webViewLink is kept as a fallback for file types Drive doesn't
    // generate a content link for (e.g. some Google-native formats,
    // not expected here since this app only ever uploads the fixed
    // allowlist of real file types in StorageService).
    const url = created.data.webContentLink ?? created.data.webViewLink;
    if (!url) throw new Error("Google Drive did not return a usable link for the uploaded file");

    return { key: fileId, url };
  }
}
