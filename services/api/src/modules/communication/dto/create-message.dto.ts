import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { MessageAudience, MessageChannel } from "@prisma/client";

export class CreateMessageDto {
  @IsEnum(MessageChannel)
  channel!: MessageChannel;

  @IsEnum(MessageAudience)
  audience!: MessageAudience;

  // Required, and only meaningful, when audience = SPECIFIC_USER —
  // validated in the service, not here, since the requirement depends
  // on another field's value.
  @IsOptional()
  @IsString()
  recipientUserId?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  // Optional here — if templateId is given, the template's body fills
  // this in server-side. At least one of the two must resolve to real
  // content, checked in the service.
  @IsOptional()
  @IsString()
  @MinLength(1)
  body?: string;
}
