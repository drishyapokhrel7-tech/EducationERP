import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ClassSessionsService } from "./class-sessions.service";
import { CreateClassSessionDto } from "./dto/create-class-session.dto";
import { RecordProgressDto } from "./dto/record-progress.dto";
import { CreateClassMaterialDto } from "./dto/create-class-material.dto";
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
export class ClassSessionsController {
  constructor(private readonly classSessions: ClassSessionsService) {}

  @Get("my-classes-today")
  @RequirePermissions("class_session:view")
  myClassesToday(@CurrentUser() user: JwtPayload, @Query("date") date?: string) {
    if (!date) throw new BadRequestException("date query parameter is required (YYYY-MM-DD)");
    return this.classSessions.myClassesToday(user.organizationId, date);
  }

  @Post("class-sessions")
  @RequirePermissions("class_session:create")
  createSession(@CurrentUser() user: JwtPayload, @Body() dto: CreateClassSessionDto) {
    return this.classSessions.createSession(user.organizationId, dto);
  }

  @Get("class-sessions/:sessionId")
  @RequirePermissions("class_session:view")
  getSession(@CurrentUser() user: JwtPayload, @Param("sessionId") sessionId: string) {
    return this.classSessions.getSession(user.organizationId, sessionId);
  }

  @Put("class-sessions/:sessionId/progress")
  @RequirePermissions("class_session:manage")
  recordProgress(
    @CurrentUser() user: JwtPayload,
    @Param("sessionId") sessionId: string,
    @Body() dto: RecordProgressDto,
  ) {
    return this.classSessions.recordProgress(user.organizationId, sessionId, dto);
  }

  @Post("class-sessions/:sessionId/materials")
  @RequirePermissions("class_session:manage")
  addMaterial(
    @CurrentUser() user: JwtPayload,
    @Param("sessionId") sessionId: string,
    @Body() dto: CreateClassMaterialDto,
  ) {
    return this.classSessions.addMaterial(user.organizationId, sessionId, dto);
  }

  @Post("class-sessions/:sessionId/complete")
  @RequirePermissions("class_session:manage")
  completeSession(@CurrentUser() user: JwtPayload, @Param("sessionId") sessionId: string) {
    return this.classSessions.completeSession(user.organizationId, sessionId);
  }

  @Get("syllabi/:syllabusId/progress")
  @RequirePermissions("syllabus:view")
  syllabusProgress(@CurrentUser() user: JwtPayload, @Param("syllabusId") syllabusId: string) {
    return this.classSessions.syllabusProgress(user.organizationId, syllabusId);
  }
}
