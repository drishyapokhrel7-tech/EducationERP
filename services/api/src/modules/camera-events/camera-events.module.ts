import { Module } from "@nestjs/common";
import { CameraEventsService } from "./camera-events.service";
import { CameraEventsController } from "./camera-events.controller";
import { AiGatewayModule } from "../ai-gateway/ai-gateway.module";
import { AttendanceReconciliationModule } from "../attendance-reconciliation/attendance-reconciliation.module";

@Module({
  imports: [AiGatewayModule, AttendanceReconciliationModule],
  providers: [CameraEventsService],
  controllers: [CameraEventsController],
})
export class CameraEventsModule {}
