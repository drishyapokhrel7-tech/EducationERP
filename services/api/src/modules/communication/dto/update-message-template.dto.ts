import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { MessageChannel } from "@prisma/client";

export class UpdateMessageTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEnum(MessageChannel)
  channel?: MessageChannel;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  body?: string;
}
