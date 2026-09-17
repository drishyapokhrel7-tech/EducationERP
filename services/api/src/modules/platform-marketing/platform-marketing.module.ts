import { Module } from "@nestjs/common";
import { PlatformMarketingService } from "./platform-marketing.service";
import { PlatformMarketingController } from "./platform-marketing.controller";

// Same "PlatformAuthGuard works without importing PlatformAuthModule"
// reasoning as PlatformOrganizationsModule's own comment.
@Module({
  providers: [PlatformMarketingService],
  controllers: [PlatformMarketingController],
})
export class PlatformMarketingModule {}
