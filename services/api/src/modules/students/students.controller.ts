import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { StudentsService } from "./students.service";
import { CreateStudentDto } from "./dto/create-student.dto";
import { CreateGuardianDto } from "./dto/create-guardian.dto";
import { AttachGuardianDto } from "./dto/attach-guardian.dto";
import { CreateEnrollmentDto } from "./dto/create-enrollment.dto";
import { UpdateStudentStatusDto } from "./dto/update-student-status.dto";
import { CreateStudentLoginDto } from "./dto/create-student-login.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me")
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get("students")
  @RequirePermissions("student:view")
  listStudents(@CurrentUser() user: JwtPayload) {
    return this.students.listStudents(user.organizationId);
  }

  @Post("students")
  @RequirePermissions("student:create")
  createStudent(@CurrentUser() user: JwtPayload, @Body() dto: CreateStudentDto) {
    return this.students.createStudent(user.organizationId, dto);
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
  // transiently to parse it.
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
    return this.students.importStudents(user.organizationId, file.buffer);
  }

  @Get("students/export")
  @RequirePermissions("student:export")
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="students.csv"')
  exportStudents(@CurrentUser() user: JwtPayload) {
    return this.students.exportStudentsCsv(user.organizationId);
  }
}
