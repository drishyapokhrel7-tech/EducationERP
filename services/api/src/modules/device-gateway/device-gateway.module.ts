import { Module } from "@nestjs/common";
import { DeviceGatewayService } from "./device-gateway.service";
import { DeviceGatewayController } from "./device-gateway.controller";
import { AttendanceReconciliationModule } from "../attendance-reconciliation/attendance-reconciliation.module";

@Module({
  imports: [AttendanceReconciliationModule],
  providers: [DeviceGatewayService],
  controllers: [DeviceGatewayController],
})
export class DeviceGatewayModule {}
