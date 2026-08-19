import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { AssignmentsService } from "./assignments.service";
import { CreateAssignmentDto } from "./dto/create-assignment.dto";
import { CreateSubmissionDto } from "./dto/create-submission.dto";
import { GradeSubmissionDto } from "./dto/grade-submission.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me")
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Get("assignments")
  @RequirePermissions("assignment:view")
  listAssignments(@CurrentUser() user: JwtPayload) {
    return this.assignments.listAssignments(user.organizationId);
  }

  @Post("assignments")
  @RequirePermissions("assignment:create")
  createAssignment(@CurrentUser() user: JwtPayload, @Body() dto: CreateAssignmentDto) {
    return this.assignments.createAssignment(user.organizationId, dto);
  }

  @Get("assignments/:assignmentId")
  @RequirePermissions("assignment:view")
  getAssignment(@CurrentUser() user: JwtPayload, @Param("assignmentId") assignmentId: string) {
    return this.assignments.getAssignment(user.organizationId, assignmentId);
  }

  @Post("assignments/:assignmentId/submissions")
  @RequirePermissions("assignment:manage")
  submit(
    @CurrentUser() user: JwtPayload,
    @Param("assignmentId") assignmentId: string,
    @Body() dto: CreateSubmissionDto,
  ) {
    return this.assignments.submit(user.organizationId, assignmentId, dto);
  }

  @Put("assignments/:assignmentId/submissions/:studentId/grade")
  @RequirePermissions("assignment:manage")
  grade(
    @CurrentUser() user: JwtPayload,
    @Param("assignmentId") assignmentId: string,
    @Param("studentId") studentId: string,
    @Body() dto: GradeSubmissionDto,
  ) {
    return this.assignments.grade(user.organizationId, assignmentId, studentId, dto);
  }
}
