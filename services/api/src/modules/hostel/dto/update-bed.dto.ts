import { IsEnum, IsOptional } from "class-validator";
import { HostelBedStatus } from "@prisma/client";

export class UpdateBedDto {
  @IsOptional()
  @IsEnum(HostelBedStatus)
  status?: HostelBedStatus;
}
