import { Module } from "@nestjs/common";
import { DriverPortalService } from "./driver-portal.service";
import { DriverPortalController } from "./driver-portal.controller";

@Module({
  providers: [DriverPortalService],
  controllers: [DriverPortalController],
})
export class DriverPortalModule {}
