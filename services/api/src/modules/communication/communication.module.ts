import { Module } from "@nestjs/common";
import { CommunicationService } from "./communication.service";
import { CommunicationController } from "./communication.controller";
import { DeliveryProvider } from "./delivery-provider";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [NotificationsModule],
  providers: [CommunicationService, DeliveryProvider],
  controllers: [CommunicationController],
})
export class CommunicationModule {}
