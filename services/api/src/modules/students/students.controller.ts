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
import { buildStudentIdCardPdf } from "./student-id-card-document";
import { CreateStudentDto } from "./dto/create-student.dto";
import { UpdateStudentDto } from "./dto/update-student.dto";
import { CreateGuardianDto } from "./dto/create-guardian.dto";
import { CreateGuardianLoginDto } from "./dto/create-guardian-login.dto";
import { UpdateGuardianDto } from "./dto/update-guardian.dto";
import { AttachGuardianDto } from "./dto/attach-guardian.dto";
import { CreateEnrollmentDto } from "./dto/create-enrollment.dto";
import { ListEnrollmentsQueryDto } from "./dto/list-enrollments.dto";
import { UpdateEnrollmentStatusDto } from "./dto/update-enrollment-status.dto";
import { CreateExtracurricularActivityDto } from "./dto/create-extracurricular-activity.dto";
import { UpdateExtracurricularActivityDto } from "./dto/update-extracurricular-activity.dto";
import { ListExtracurricularActivitiesQueryDto } from "./dto/list-extracurricular-activities.dto";
import { CreateActivityLookupDto } from "./dto/create-activity-lookup.dto";
import { UpdateActivityLookupDto } from "./dto/update-activity-lookup.dto";
import { ExtracurricularActivityLookupKind } from "@prisma/client";
import { UpdateStudentStatusDto } from "./dto/update-student-status.dto";
import { CreateStudentLoginDto } from "./dto/create-student-login.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";
import { IMPORT_UPLOAD_OPTIONS } from "../../common/upload-limits";

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

  // Printable ID card — one card (org header + photo + name/ID/class/
  // DOB) centred on an A4 page. student:view (same as opening the
  // record), @Res() for the Buffer.
  @Get("students/:id/id-card")
  @RequirePermissions("student:view")
  async getStudentIdCard(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Res() res: Response) {
    const { org, student } = await this.students.getStudentIdCardDocument(user.organizationId, id);
    const pdf = await buildStudentIdCardPdf(org, student);
    res.set("Content-Type", "application/pdf");
    res.set("Content-Disposition", `inline; filename="id-card-${student.studentCode}.pdf"`);
    res.send(pdf);
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

  @Post("guardians/:guardianId/create-login")
  @RequirePermissions("guardian:manage")
  createGuardianLogin(
    @CurrentUser() user: JwtPayload,
    @Param("guardianId") guardianId: string,
    @Body() dto: CreateGuardianLoginDto,
  ) {
    return this.students.createGuardianLogin(user.organizationId, guardianId, dto);
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

  @Get("students/:studentId/extracurricular-activities")
  @RequirePermissions("extracurricular_activity:view")
  listActivities(@CurrentUser() user: JwtPayload, @Param("studentId") studentId: string) {
    return this.students.listActivities(user.organizationId, studentId);
  }

  @Post("students/:studentId/extracurricular-activities")
  @RequirePermissions("extracurricular_activity:create")
  createActivity(
    @CurrentUser() user: JwtPayload,
    @Param("studentId") studentId: string,
    @Body() dto: CreateExtracurricularActivityDto,
  ) {
    return this.students.createActivity(user.organizationId, studentId, dto);
  }

  // Org-wide, not per-student — the real list view behind the
  // Extra-curricular Activities card, optionally filtered by student.
  @Get("extracurricular-activities")
  @RequirePermissions("extracurricular_activity:view")
  listAllActivities(@CurrentUser() user: JwtPayload, @Query() filters: ListExtracurricularActivitiesQueryDto) {
    return this.students.listAllActivities(user.organizationId, filters);
  }

  @Patch("extracurricular-activities/:id")
  @RequirePermissions("extracurricular_activity:update")
  updateActivity(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: UpdateExtracurricularActivityDto,
  ) {
    return this.students.updateActivity(user.organizationId, id, dto);
  }

  @Delete("extracurricular-activities/:id")
  @RequirePermissions("extracurricular_activity:delete")
  deleteActivity(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.students.deleteActivity(user.organizationId, id);
  }

  @Post("activity-lookups")
  @RequirePermissions("extracurricular_activity:manage")
  createActivityLookup(@CurrentUser() user: JwtPayload, @Body() dto: CreateActivityLookupDto) {
    return this.students.createActivityLookup(user.organizationId, dto);
  }

  @Get("activity-lookups")
  @RequirePermissions("extracurricular_activity:view")
  listActivityLookups(@CurrentUser() user: JwtPayload, @Query("kind") kind?: ExtracurricularActivityLookupKind) {
    return this.students.listActivityLookups(user.organizationId, kind);
  }

  @Patch("activity-lookups/:id")
  @RequirePermissions("extracurricular_activity:manage")
  updateActivityLookup(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateActivityLookupDto) {
    return this.students.updateActivityLookup(user.organizationId, id, dto);
  }

  @Delete("activity-lookups/:id")
  @RequirePermissions("extracurricular_activity:manage")
  deleteActivityLookup(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.students.deleteActivityLookup(user.organizationId, id);
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
  @UseInterceptors(FileInterceptor("file", IMPORT_UPLOAD_OPTIONS))
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

  // The other half of the round trip with students/import — same
  // @Res()+res.send(buffer) reasoning as downloadImportTemplate above.
  @Get("students/export-editable")
  @RequirePermissions("student:export")
  async exportEditable(@CurrentUser() user: JwtPayload, @Res() res: Response) {
    const buffer = await this.students.exportEditableStudents(user.organizationId);
    res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.set("Content-Disposition", 'attachment; filename="students-editable.xlsx"');
    res.send(buffer);
  }
}
