import { Module } from "@nestjs/common";
import { LibraryPortalService } from "./library-portal.service";
import { LibraryPortalController } from "./library-portal.controller";

@Module({
  providers: [LibraryPortalService],
  controllers: [LibraryPortalController],
})
export class LibraryPortalModule {}
