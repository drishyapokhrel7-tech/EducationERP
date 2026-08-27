import { BadRequestException, Controller, Post, UseGuards, UseInterceptors, UploadedFile } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { Express } from "express";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";
import { StorageService } from "./storage.service";

// Deliberately JwtAuthGuard only, no @RequirePermissions — any
// authenticated user (a teacher uploading course material, a student
// uploading a file submission) can store a file tagged to their own
// organization. There's nothing here for an IDOR to target: the
// resulting URL only becomes meaningful once attached through
// whatever already-ownership-checked endpoint uses it (a module item,
// a class material, an assignment submission) — this endpoint itself
// never reveals or lets anyone touch another person's data.
@UseGuards(JwtAuthGuard)
@Controller("organizations/me/uploads")
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Post()
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage() }))
  async upload(@CurrentUser() user: JwtPayload, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException("No file provided");
    return this.storage.upload(user.organizationId, {
      buffer: file.buffer,
      originalName: file.originalname,
      mimetype: file.mimetype,
    });
  }
}
