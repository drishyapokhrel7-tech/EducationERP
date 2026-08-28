import { Module } from "@nestjs/common";
import { CommunicationService } from "./communication.service";
import { CommunicationController } from "./communication.controller";
import { DeliveryProvider } from "./delivery-provider";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [NotificationsModule],
  providers: [CommunicationService, DeliveryProvider],
  controllers: [CommunicationController],
  // DeliveryProvider is also the seam AuthModule uses to send real
  // verification/reset-code email (see delivery-provider.ts) — exported
  // so AuthModule can inject it without duplicating the Gmail-sending
  // logic.
  exports: [DeliveryProvider],
})
export class CommunicationModule {}
