import { IsOptional, IsString } from "class-validator";

export class RecordProgressDto {
  @IsOptional()
  @IsString()
  actualSyllabusNodeId?: string;

  @IsOptional()
  @IsString()
  progressNotes?: string;
}
