import { IsEnum } from "class-validator";
import { HostelMaintenanceStatus } from "@prisma/client";

export class UpdateMaintenanceRequestDto {
  @IsEnum(HostelMaintenanceStatus)
  status!: HostelMaintenanceStatus;
}
