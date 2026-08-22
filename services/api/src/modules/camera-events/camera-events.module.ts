import { Module } from "@nestjs/common";
import { CameraEventsService } from "./camera-events.service";
import { CameraEventsController } from "./camera-events.controller";
import { AiGatewayModule } from "../ai-gateway/ai-gateway.module";

@Module({
  imports: [AiGatewayModule],
  providers: [CameraEventsService],
  controllers: [CameraEventsController],
})
export class CameraEventsModule {}
