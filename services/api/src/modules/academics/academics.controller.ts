import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AcademicsService } from "./academics.service";
import { CreateSubjectDto } from "./dto/create-subject.dto";
import { CreateCurriculumDto } from "./dto/create-curriculum.dto";
import { AttachCurriculumSubjectDto } from "./dto/attach-curriculum-subject.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me")
export class AcademicsController {
  constructor(private readonly academics: AcademicsService) {}

  @Get("subjects")
  @RequirePermissions("subject:view")
  listSubjects(@CurrentUser() user: JwtPayload) {
    return this.academics.listSubjects(user.organizationId);
  }

  @Post("subjects")
  @RequirePermissions("subject:create")
  createSubject(@CurrentUser() user: JwtPayload, @Body() dto: CreateSubjectDto) {
    return this.academics.createSubject(user.organizationId, dto);
  }

  @Get("curricula")
  @RequirePermissions("curriculum:view")
  listCurricula(@CurrentUser() user: JwtPayload) {
    return this.academics.listCurricula(user.organizationId);
  }

  @Post("curricula")
  @RequirePermissions("curriculum:create")
  createCurriculum(@CurrentUser() user: JwtPayload, @Body() dto: CreateCurriculumDto) {
    return this.academics.createCurriculum(user.organizationId, dto);
  }

  @Post("curricula/:curriculumId/subjects")
  @RequirePermissions("curriculum:manage")
  attachSubject(
    @CurrentUser() user: JwtPayload,
    @Param("curriculumId") curriculumId: string,
    @Body() dto: AttachCurriculumSubjectDto,
  ) {
    return this.academics.attachSubject(user.organizationId, curriculumId, dto);
  }
}
