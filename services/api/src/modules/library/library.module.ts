import { Module } from "@nestjs/common";
import { LibraryService } from "./library.service";
import { LibraryController } from "./library.controller";
import { NotificationsModule } from "../notifications/notifications.module";
import { AiGatewayModule } from "../ai-gateway/ai-gateway.module";

@Module({
  imports: [NotificationsModule, AiGatewayModule],
  providers: [LibraryService],
  controllers: [LibraryController],
})
export class LibraryModule {}
