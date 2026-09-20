import { IsOptional, IsString, MinLength } from "class-validator";

export class UpdateIncidentTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
