import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { AdmissionsService } from "./admissions.service";
import { CreateAdmissionApplicationDto } from "./dto/create-admission-application.dto";
import { UpdateAdmissionStatusDto } from "./dto/update-admission-status.dto";
import { EnrollApplicationDto } from "./dto/enroll-application.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me/admission-applications")
export class AdmissionsController {
  constructor(private readonly admissions: AdmissionsService) {}

  @Get()
  @RequirePermissions("admission:view")
  listApplications(@CurrentUser() user: JwtPayload) {
    return this.admissions.listApplications(user.organizationId);
  }

  @Post()
  @RequirePermissions("admission:create")
  createApplication(@CurrentUser() user: JwtPayload, @Body() dto: CreateAdmissionApplicationDto) {
    return this.admissions.createApplication(user.organizationId, dto);
  }

  @Get(":applicationId/status-history")
  @RequirePermissions("admission:view")
  listStatusHistory(@CurrentUser() user: JwtPayload, @Param("applicationId") applicationId: string) {
    return this.admissions.listStatusHistory(user.organizationId, applicationId);
  }

  @Put(":applicationId/status")
  @RequirePermissions("admission:manage")
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param("applicationId") applicationId: string,
    @Body() dto: UpdateAdmissionStatusDto,
  ) {
    return this.admissions.updateStatus(user.organizationId, applicationId, dto);
  }

  @Post(":applicationId/enroll")
  @RequirePermissions("admission:manage")
  enroll(
    @CurrentUser() user: JwtPayload,
    @Param("applicationId") applicationId: string,
    @Body() dto: EnrollApplicationDto,
  ) {
    return this.admissions.enroll(user.organizationId, applicationId, dto);
  }
}
