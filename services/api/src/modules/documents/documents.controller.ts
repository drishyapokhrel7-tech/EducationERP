import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { DocumentsService } from "./documents.service";
import { CreateStudentDocumentDto } from "./dto/create-student-document.dto";
import { CreateStaffDocumentDto } from "./dto/create-staff-document.dto";
import { ReviewDocumentDto } from "./dto/review-document.dto";
import { CreateCertificateDto } from "./dto/create-certificate.dto";
import { RevokeCertificateDto } from "./dto/revoke-certificate.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

import { RequireEditionGuard } from "../../common/auth/require-edition.guard";
import { RequireEdition } from "../../common/auth/require-edition.decorator";

@UseGuards(JwtAuthGuard, PermissionsGuard, RequireEditionGuard)
@RequireEdition("ULTRA")
@Controller("organizations/me")
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post("student-documents")
  @RequirePermissions("document:create")
  createStudentDocument(@CurrentUser() user: JwtPayload, @Body() dto: CreateStudentDocumentDto) {
    return this.documents.createStudentDocument(user.organizationId, dto);
  }

  @Get("student-documents")
  @RequirePermissions("document:view")
  listStudentDocuments(@CurrentUser() user: JwtPayload, @Query("studentId") studentId?: string) {
    return this.documents.listStudentDocuments(user.organizationId, studentId);
  }

  @Patch("student-documents/:id/review")
  @RequirePermissions("document:manage")
  reviewStudentDocument(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: ReviewDocumentDto) {
    return this.documents.reviewStudentDocument(user.organizationId, user.sub, id, dto);
  }

  @Post("staff-documents")
  @RequirePermissions("document:create")
  createStaffDocument(@CurrentUser() user: JwtPayload, @Body() dto: CreateStaffDocumentDto) {
    return this.documents.createStaffDocument(user.organizationId, dto);
  }

  @Get("staff-documents")
  @RequirePermissions("document:view")
  listStaffDocuments(@CurrentUser() user: JwtPayload, @Query("employeeId") employeeId?: string) {
    return this.documents.listStaffDocuments(user.organizationId, employeeId);
  }

  @Patch("staff-documents/:id/review")
  @RequirePermissions("document:manage")
  reviewStaffDocument(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: ReviewDocumentDto) {
    return this.documents.reviewStaffDocument(user.organizationId, user.sub, id, dto);
  }

  @Post("certificates")
  @RequirePermissions("document:manage")
  createCertificate(@CurrentUser() user: JwtPayload, @Body() dto: CreateCertificateDto) {
    return this.documents.createCertificate(user.organizationId, user.sub, dto);
  }

  @Get("certificates")
  @RequirePermissions("document:view")
  listCertificates(@CurrentUser() user: JwtPayload, @Query("studentId") studentId?: string) {
    return this.documents.listCertificates(user.organizationId, studentId);
  }

  @Post("certificates/:id/revoke")
  @RequirePermissions("document:manage")
  revokeCertificate(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: RevokeCertificateDto) {
    return this.documents.revokeCertificate(user.organizationId, id, dto);
  }
}
