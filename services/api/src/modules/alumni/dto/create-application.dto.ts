import { IsOptional, IsString } from "class-validator";

export class CreateApplicationDto {
  @IsOptional()
  @IsString()
  coverNote?: string;
}
