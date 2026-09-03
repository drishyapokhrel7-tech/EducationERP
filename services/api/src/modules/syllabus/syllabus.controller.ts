import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { SyllabusService } from "./syllabus.service";
import { CreateSyllabusDto } from "./dto/create-syllabus.dto";
import { CreateSyllabusNodeDto } from "./dto/create-syllabus-node.dto";
import { CreateLearningObjectiveDto } from "./dto/create-learning-objective.dto";
import { CreateLessonPlanDto } from "./dto/create-lesson-plan.dto";
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
export class SyllabusController {
  constructor(private readonly syllabus: SyllabusService) {}

  @Get("syllabi")
  @RequirePermissions("syllabus:view")
  listSyllabi(@CurrentUser() user: JwtPayload) {
    return this.syllabus.listSyllabi(user.organizationId);
  }

  @Post("syllabi")
  @RequirePermissions("syllabus:create")
  createSyllabus(@CurrentUser() user: JwtPayload, @Body() dto: CreateSyllabusDto) {
    return this.syllabus.createSyllabus(user.organizationId, dto);
  }

  @Get("syllabi/:syllabusId")
  @RequirePermissions("syllabus:view")
  getSyllabus(@CurrentUser() user: JwtPayload, @Param("syllabusId") syllabusId: string) {
    return this.syllabus.getSyllabus(user.organizationId, syllabusId);
  }

  @Post("syllabi/:syllabusId/nodes")
  @RequirePermissions("syllabus:manage")
  createNode(
    @CurrentUser() user: JwtPayload,
    @Param("syllabusId") syllabusId: string,
    @Body() dto: CreateSyllabusNodeDto,
  ) {
    return this.syllabus.createNode(user.organizationId, syllabusId, dto);
  }

  @Post("syllabus-nodes/:nodeId/objectives")
  @RequirePermissions("syllabus:manage")
  createObjective(
    @CurrentUser() user: JwtPayload,
    @Param("nodeId") nodeId: string,
    @Body() dto: CreateLearningObjectiveDto,
  ) {
    return this.syllabus.createObjective(user.organizationId, nodeId, dto);
  }

  @Get("lesson-plans")
  @RequirePermissions("lesson_plan:view")
  listLessonPlans(@CurrentUser() user: JwtPayload) {
    return this.syllabus.listLessonPlans(user.organizationId);
  }

  @Post("lesson-plans")
  @RequirePermissions("lesson_plan:create")
  createLessonPlan(@CurrentUser() user: JwtPayload, @Body() dto: CreateLessonPlanDto) {
    return this.syllabus.createLessonPlan(user.organizationId, dto);
  }
}
