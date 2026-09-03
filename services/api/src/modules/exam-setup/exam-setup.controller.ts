import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ExamSetupService } from "./exam-setup.service";
import { CreateExamTypeDto } from "./dto/create-exam-type.dto";
import { UpdateExamTypeDto } from "./dto/update-exam-type.dto";
import { CreateGradingSchemeDto } from "./dto/create-grading-scheme.dto";
import { UpdateGradingSchemeDto } from "./dto/update-grading-scheme.dto";
import { CreateQuestionBankDto } from "./dto/create-question-bank.dto";
import { CreateQuestionDto } from "./dto/create-question.dto";
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
export class ExamSetupController {
  constructor(private readonly examSetup: ExamSetupService) {}

  @Get("exam-types")
  @RequirePermissions("exam_type:view")
  listExamTypes(@CurrentUser() user: JwtPayload) {
    return this.examSetup.listExamTypes(user.organizationId);
  }

  @Post("exam-types")
  @RequirePermissions("exam_type:create")
  createExamType(@CurrentUser() user: JwtPayload, @Body() dto: CreateExamTypeDto) {
    return this.examSetup.createExamType(user.organizationId, dto);
  }

  @Patch("exam-types/:id")
  @RequirePermissions("exam_type:update")
  updateExamType(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateExamTypeDto) {
    return this.examSetup.updateExamType(user.organizationId, id, dto);
  }

  @Delete("exam-types/:id")
  @RequirePermissions("exam_type:delete")
  deleteExamType(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.examSetup.deleteExamType(user.organizationId, id);
  }

  @Get("grading-schemes")
  @RequirePermissions("grading_scheme:view")
  listGradingSchemes(@CurrentUser() user: JwtPayload) {
    return this.examSetup.listGradingSchemes(user.organizationId);
  }

  @Post("grading-schemes")
  @RequirePermissions("grading_scheme:create")
  createGradingScheme(@CurrentUser() user: JwtPayload, @Body() dto: CreateGradingSchemeDto) {
    return this.examSetup.createGradingScheme(user.organizationId, dto);
  }

  @Patch("grading-schemes/:id")
  @RequirePermissions("grading_scheme:update")
  updateGradingScheme(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateGradingSchemeDto) {
    return this.examSetup.updateGradingScheme(user.organizationId, id, dto);
  }

  @Delete("grading-schemes/:id")
  @RequirePermissions("grading_scheme:delete")
  deleteGradingScheme(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.examSetup.deleteGradingScheme(user.organizationId, id);
  }

  @Get("question-banks")
  @RequirePermissions("question_bank:view")
  listQuestionBanks(@CurrentUser() user: JwtPayload) {
    return this.examSetup.listQuestionBanks(user.organizationId);
  }

  @Post("question-banks")
  @RequirePermissions("question_bank:create")
  createQuestionBank(@CurrentUser() user: JwtPayload, @Body() dto: CreateQuestionBankDto) {
    return this.examSetup.createQuestionBank(user.organizationId, dto);
  }

  @Get("question-banks/:questionBankId")
  @RequirePermissions("question_bank:view")
  getQuestionBank(@CurrentUser() user: JwtPayload, @Param("questionBankId") questionBankId: string) {
    return this.examSetup.getQuestionBank(user.organizationId, questionBankId);
  }

  @Post("question-banks/:questionBankId/questions")
  @RequirePermissions("question:create")
  addQuestion(
    @CurrentUser() user: JwtPayload,
    @Param("questionBankId") questionBankId: string,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.examSetup.addQuestion(user.organizationId, questionBankId, dto);
  }
}
