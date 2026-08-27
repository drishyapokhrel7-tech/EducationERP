import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateAnnouncementDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  body?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
