import { existsSync } from "fs";
import { join, resolve } from "path";
import { Controller, Get, NotFoundException, Param, Res } from "@nestjs/common";
import type { Response } from "express";

// Public, unauthenticated — deliberately: an uploaded file's link is
// meant to work exactly like a pasted external link already does
// everywhere in this app (a YouTube URL, a Google Drive link), openable
// by anyone who has it, not gated behind a login. Only relevant when
// STORAGE_DRIVER=local; harmless (plain 404s) when it isn't, since
// nothing is ever written under LOCAL_STORAGE_DIR in that case.
//
// Both path segments are validated against a strict charset before
// touching the filesystem — unlike LocalDiskStorageDriver's write side
// (where organizationId is a server-derived JWT claim and the filename
// is always a UUID we generate), these come straight from the URL, so
// an attacker-supplied "../../etc/passwd"-style segment has to be
// rejected here, not assumed safe because the write side never
// produces one.
const SAFE_SEGMENT = /^[A-Za-z0-9-]+$/;
const SAFE_FILENAME = /^[A-Za-z0-9-]+(\.[A-Za-z0-9]+)?$/;

@Controller("uploads")
export class LocalFilesController {
  private readonly rootDir = resolve(process.env.LOCAL_STORAGE_DIR ?? "./uploads");

  @Get(":organizationId/:filename")
  serve(@Param("organizationId") organizationId: string, @Param("filename") filename: string, @Res() res: Response) {
    if (!SAFE_SEGMENT.test(organizationId) || !SAFE_FILENAME.test(filename)) {
      throw new NotFoundException("File not found");
    }
    const filePath = resolve(join(this.rootDir, organizationId, filename));
    // Defense in depth beyond the regex above: the resolved path must
    // still land inside rootDir.
    if (!filePath.startsWith(this.rootDir) || !existsSync(filePath)) {
      throw new NotFoundException("File not found");
    }
    res.sendFile(filePath);
  }
}
