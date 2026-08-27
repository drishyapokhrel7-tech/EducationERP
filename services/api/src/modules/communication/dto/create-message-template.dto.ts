import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { MessageChannel } from "@prisma/client";

export class CreateMessageTemplateDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(MessageChannel)
  channel!: MessageChannel;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  @MinLength(1)
  body!: string;
}
