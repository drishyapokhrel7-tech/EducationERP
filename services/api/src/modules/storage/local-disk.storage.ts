import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { dirname, extname, join } from "path";
import { Injectable } from "@nestjs/common";
import type { StorageDriver, StoredFile, UploadedFileInput } from "./storage.types";

// Default driver — zero setup, zero new paid dependency, same "the
// free/self-hosted path always works out of the box" precedent as
// every other slice in this project (OpenStreetMap over Google Maps,
// generating quiz questions directly instead of standing up an LLM
// service). Fine for a persistent-process deployment (`pnpm dev`,
// `node dist/main.js`, any traditional host); NOT durable on Vercel
// serverless, whose filesystem is ephemeral per-invocation — that
// deployment target needs STORAGE_DRIVER=s3 instead, stated plainly
// rather than silently losing files.
@Injectable()
export class LocalDiskStorageDriver implements StorageDriver {
  private readonly dir = process.env.LOCAL_STORAGE_DIR ?? "./uploads";
  private readonly publicBaseUrl =
    process.env.LOCAL_STORAGE_PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 4000}/uploads`;

  async upload(organizationId: string, file: UploadedFileInput): Promise<StoredFile> {
    // organizationId is always a server-derived JWT claim, never a
    // request param, and the filename half is always a fresh UUID we
    // generate — never the caller's own originalName — so this key is
    // never attacker-influenced path input, unlike the read side
    // (LocalFilesController), which has to re-validate it on the way
    // back in since that route *does* take it from the URL.
    const key = `${organizationId}/${randomUUID()}${extname(file.originalName)}`;
    const fullPath = join(this.dir, key);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, file.buffer);
    return { key, url: `${this.publicBaseUrl}/${key}` };
  }
}
