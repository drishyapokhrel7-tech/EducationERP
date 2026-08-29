import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { StudentsService } from "./students.service";
import { CreateStudentDto } from "./dto/create-student.dto";
import { UpdateStudentDto } from "./dto/update-student.dto";
import { CreateGuardianDto } from "./dto/create-guardian.dto";
import { UpdateGuardianDto } from "./dto/update-guardian.dto";
import { AttachGuardianDto } from "./dto/attach-guardian.dto";
import { CreateEnrollmentDto } from "./dto/create-enrollment.dto";
import { ListEnrollmentsQueryDto } from "./dto/list-enrollments.dto";
import { UpdateEnrollmentStatusDto } from "./dto/update-enrollment-status.dto";
import { UpdateStudentStatusDto } from "./dto/update-student-status.dto";
import { CreateStudentLoginDto } from "./dto/create-student-login.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me")
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get("students")
  @RequirePermissions("student:view")
  listStudents(@CurrentUser() user: JwtPayload, @Query() pagination: PaginationQueryDto) {
    return this.students.listStudents(user.organizationId, pagination.page ?? 1, pagination.pageSize ?? 25);
  }

  // Deliberately separate from the paginated listStudents above — see
  // StudentsService.listStudentsPicker's comment. Reuses the same
  // student:view permission (this returns strictly less data).
  @Get("students/picker")
  @RequirePermissions("student:view")
  listStudentsPicker(@CurrentUser() user: JwtPayload) {
    return this.students.listStudentsPicker(user.organizationId);
  }

  @Post("students")
  @RequirePermissions("student:create")
  createStudent(@CurrentUser() user: JwtPayload, @Body() dto: CreateStudentDto) {
    return this.students.createStudent(user.organizationId, dto);
  }

  @Patch("students/:id")
  @RequirePermissions("student:update")
  updateStudent(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateStudentDto) {
    return this.students.updateStudent(user.organizationId, id, dto);
  }

  @Delete("students/:id")
  @RequirePermissions("student:delete")
  deleteStudent(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.students.deleteStudent(user.organizationId, id);
  }

  @Get("guardians")
  @RequirePermissions("guardian:view")
  listGuardians(@CurrentUser() user: JwtPayload) {
    return this.students.listGuardians(user.organizationId);
  }

  @Post("guardians")
  @RequirePermissions("guardian:create")
  createGuardian(@CurrentUser() user: JwtPayload, @Body() dto: CreateGuardianDto) {
    return this.students.createGuardian(user.organizationId, dto);
  }

  @Patch("guardians/:id")
  @RequirePermissions("guardian:update")
  updateGuardian(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateGuardianDto) {
    return this.students.updateGuardian(user.organizationId, id, dto);
  }

  @Delete("guardians/:id")
  @RequirePermissions("guardian:delete")
  deleteGuardian(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.students.deleteGuardian(user.organizationId, id);
  }

  @Post("students/:studentId/guardians")
  @RequirePermissions("guardian:manage")
  attachGuardian(
    @CurrentUser() user: JwtPayload,
    @Param("studentId") studentId: string,
    @Body() dto: AttachGuardianDto,
  ) {
    return this.students.attachGuardian(user.organizationId, studentId, dto);
  }

  @Get("students/:studentId/enrollments")
  @RequirePermissions("enrollment:view")
  listEnrollments(@CurrentUser() user: JwtPayload, @Param("studentId") studentId: string) {
    return this.students.listEnrollments(user.organizationId, studentId);
  }

  @Post("students/:studentId/enrollments")
  @RequirePermissions("enrollment:create")
  createEnrollment(
    @CurrentUser() user: JwtPayload,
    @Param("studentId") studentId: string,
    @Body() dto: CreateEnrollmentDto,
  ) {
    return this.students.createEnrollment(user.organizationId, studentId, dto);
  }

  @Get("students/:studentId/status-history")
  @RequirePermissions("student:view")
  listStatusHistory(@CurrentUser() user: JwtPayload, @Param("studentId") studentId: string) {
    return this.students.listStatusHistory(user.organizationId, studentId);
  }

  // Org-wide, not per-student — the real list view behind the
  // Enrollment card, filterable by program/term/section/status.
  @Get("enrollments")
  @RequirePermissions("enrollment:view")
  listAllEnrollments(@CurrentUser() user: JwtPayload, @Query() filters: ListEnrollmentsQueryDto) {
    return this.students.listAllEnrollments(user.organizationId, filters);
  }

  @Patch("enrollments/:id/status")
  @RequirePermissions("enrollment:update")
  updateEnrollmentStatus(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: UpdateEnrollmentStatusDto,
  ) {
    return this.students.updateEnrollmentStatus(user.organizationId, id, dto);
  }

  @Put("students/:studentId/status")
  @RequirePermissions("student:manage")
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param("studentId") studentId: string,
    @Body() dto: UpdateStudentStatusDto,
  ) {
    return this.students.updateStatus(user.organizationId, studentId, dto);
  }

  @Post("students/:studentId/create-login")
  @RequirePermissions("student:manage")
  createLogin(
    @CurrentUser() user: JwtPayload,
    @Param("studentId") studentId: string,
    @Body() dto: CreateStudentLoginDto,
  ) {
    return this.students.createLogin(user.organizationId, studentId, dto);
  }

  // No storage config → multer's default (memory only, never written to
  // disk) — deliberate: object storage for real document uploads is
  // still an open decision, this endpoint only ever needs the file
  // transiently to parse it. Accepts both the .xlsx import template
  // (StudentsService.parseXlsxRows) and plain CSV — decided by the
  // uploaded filename's extension.
  @Post("students/import")
  @RequirePermissions("student:create")
  @UseInterceptors(FileInterceptor("file"))
  importStudents(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException("No file uploaded (expected a multipart field named 'file')");
    }
    return this.students.importStudents(user.organizationId, file.buffer, file.originalname);
  }

  // Same permission as the import it feeds — generating the template
  // is part of that workflow, not a separate capability. Uses @Res()
  // + res.send(buffer) directly rather than a plain `return` +
  // @Header — Nest's default response handling JSON-serializes a
  // returned Buffer instead of writing its raw bytes (silently
  // corrupts the file), the same reason the Analytics module's own
  // xlsx export already bypasses it (see AnalyticsController.sendTable).
  @Get("students/import-template")
  @RequirePermissions("student:create")
  async downloadImportTemplate(@Res() res: Response) {
    const buffer = await this.students.generateImportTemplate();
    res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.set("Content-Disposition", 'attachment; filename="students-import-template.xlsx"');
    res.send(buffer);
  }

  @Get("students/export")
  @RequirePermissions("student:export")
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="students.csv"')
  exportStudents(@CurrentUser() user: JwtPayload) {
    return this.students.exportStudentsCsv(user.organizationId);
  }
}
