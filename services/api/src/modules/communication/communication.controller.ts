import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CommunicationService } from "./communication.service";
import { CreateMessageTemplateDto } from "./dto/create-message-template.dto";
import { CreateMessageDto } from "./dto/create-message.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me")
export class CommunicationController {
  constructor(private readonly communication: CommunicationService) {}

  @Post("message-templates")
  @RequirePermissions("communication:create")
  createTemplate(@CurrentUser() user: JwtPayload, @Body() dto: CreateMessageTemplateDto) {
    return this.communication.createTemplate(user.organizationId, dto);
  }

  @Get("message-templates")
  @RequirePermissions("communication:view")
  listTemplates(@CurrentUser() user: JwtPayload) {
    return this.communication.listTemplates(user.organizationId);
  }

  @Post("messages")
  @RequirePermissions("communication:create")
  createMessage(@CurrentUser() user: JwtPayload, @Body() dto: CreateMessageDto) {
    return this.communication.createMessage(user.organizationId, user.sub, dto);
  }

  @Get("messages")
  @RequirePermissions("communication:view")
  listMessages(@CurrentUser() user: JwtPayload) {
    return this.communication.listMessages(user.organizationId);
  }

  @Post("messages/:id/send")
  @RequirePermissions("communication:manage")
  sendMessage(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.communication.sendMessage(user.organizationId, id);
  }
}
