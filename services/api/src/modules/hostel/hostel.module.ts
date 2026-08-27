import { Module } from "@nestjs/common";
import { HostelService } from "./hostel.service";
import { HostelController } from "./hostel.controller";

@Module({
  providers: [HostelService],
  controllers: [HostelController],
})
export class HostelModule {}
