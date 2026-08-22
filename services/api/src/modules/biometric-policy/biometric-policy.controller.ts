import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { BiometricPolicyService } from "./biometric-policy.service";
import { UpdateBiometricPolicyDto } from "./dto/update-biometric-policy.dto";
import { CreateFaceEnrollmentDto } from "./dto/create-face-enrollment.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me")
export class BiometricPolicyController {
  constructor(private readonly biometricPolicy: BiometricPolicyService) {}

  @Get("biometric-policy")
  @RequirePermissions("biometric_policy:view")
  getPolicy(@CurrentUser() user: JwtPayload) {
    return this.biometricPolicy.getPolicy(user.organizationId);
  }

  @Put("biometric-policy")
  @RequirePermissions("biometric_policy:update")
  updatePolicy(@CurrentUser() user: JwtPayload, @Body() dto: UpdateBiometricPolicyDto) {
    return this.biometricPolicy.updatePolicy(user.organizationId, user.sub, dto);
  }

  @Post("biometric/enrollments")
  @RequirePermissions("biometric_enrollment:create")
  createEnrollment(@CurrentUser() user: JwtPayload, @Body() dto: CreateFaceEnrollmentDto) {
    return this.biometricPolicy.createEnrollment(user.organizationId, user.sub, dto);
  }

  @Get("biometric/enrollments")
  @RequirePermissions("biometric_enrollment:view")
  listEnrollments(@CurrentUser() user: JwtPayload) {
    return this.biometricPolicy.listEnrollments(user.organizationId);
  }

  @Post("biometric/enrollments/:id/withdraw")
  @RequirePermissions("biometric_enrollment:update")
  withdrawEnrollment(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.biometricPolicy.withdrawEnrollment(user.organizationId, user.sub, id);
  }
}
