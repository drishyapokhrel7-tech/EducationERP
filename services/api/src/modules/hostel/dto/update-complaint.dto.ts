import { IsEnum, IsOptional, IsString } from "class-validator";
import { HostelComplaintStatus } from "@prisma/client";

export class UpdateComplaintDto {
  @IsEnum(HostelComplaintStatus)
  status!: HostelComplaintStatus;

  @IsOptional()
  @IsString()
  resolutionNotes?: string;
}
