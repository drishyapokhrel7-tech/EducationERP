import { Module } from "@nestjs/common";
import { StorageService } from "./storage.service";
import { UploadsController } from "./uploads.controller";
import { LocalFilesController } from "./local-files.controller";

@Module({
  providers: [StorageService],
  controllers: [UploadsController, LocalFilesController],
  exports: [StorageService],
})
export class StorageModule {}
