import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { KnowledgeChecksService } from "./knowledge-checks.service";
import { CreateKnowledgeCheckDto } from "./dto/create-knowledge-check.dto";
import { CreateQuestionDto } from "./dto/create-question.dto";
import { CreateAttemptDto } from "./dto/create-attempt.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

import { RequireEditionGuard } from "../../common/auth/require-edition.guard";
import { RequireEdition } from "../../common/auth/require-edition.decorator";

@UseGuards(JwtAuthGuard, PermissionsGuard, RequireEditionGuard)
@RequireEdition("PROFESSIONAL")
@Controller("organizations/me")
export class KnowledgeChecksController {
  constructor(private readonly knowledgeChecks: KnowledgeChecksService) {}

  @Get("knowledge-checks")
  @RequirePermissions("knowledge_check:view")
  listChecks(@CurrentUser() user: JwtPayload) {
    return this.knowledgeChecks.listChecks(user.organizationId);
  }

  @Post("knowledge-checks")
  @RequirePermissions("knowledge_check:create")
  createCheck(@CurrentUser() user: JwtPayload, @Body() dto: CreateKnowledgeCheckDto) {
    return this.knowledgeChecks.createCheck(user.organizationId, dto);
  }

  @Get("knowledge-checks/:checkId")
  @RequirePermissions("knowledge_check:view")
  getCheck(@CurrentUser() user: JwtPayload, @Param("checkId") checkId: string) {
    return this.knowledgeChecks.getCheck(user.organizationId, checkId);
  }

  @Post("knowledge-checks/:checkId/questions")
  @RequirePermissions("knowledge_check:manage")
  addQuestion(
    @CurrentUser() user: JwtPayload,
    @Param("checkId") checkId: string,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.knowledgeChecks.addQuestion(user.organizationId, checkId, dto);
  }

  @Post("knowledge-checks/:checkId/publish")
  @RequirePermissions("knowledge_check:manage")
  publish(@CurrentUser() user: JwtPayload, @Param("checkId") checkId: string) {
    return this.knowledgeChecks.publish(user.organizationId, checkId);
  }

  @Post("knowledge-checks/:checkId/attempts")
  @RequirePermissions("knowledge_check:manage")
  attempt(
    @CurrentUser() user: JwtPayload,
    @Param("checkId") checkId: string,
    @Body() dto: CreateAttemptDto,
  ) {
    return this.knowledgeChecks.attempt(user.organizationId, checkId, dto);
  }
}
