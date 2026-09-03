import { Module } from "@nestjs/common";
import { HealthWatchdogController } from "./health-watchdog.controller";
import { CommunicationModule } from "../communication/communication.module";

// Needs CommunicationModule only for its exported DeliveryProvider —
// see health-watchdog.controller.ts. PrismaService needs no explicit
// import here since PrismaModule is @Global().
@Module({
  imports: [CommunicationModule],
  controllers: [HealthWatchdogController],
})
export class HealthWatchdogModule {}
