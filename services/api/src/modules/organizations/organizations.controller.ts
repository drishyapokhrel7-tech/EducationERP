import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { OrganizationsService } from "./organizations.service";
import { CreateCampusDto } from "./dto/create-campus.dto";
import { UpdateCampusDto } from "./dto/update-campus.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me")
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  getOwn(@CurrentUser() user: JwtPayload) {
    return this.organizationsService.getOwnOrganization(user.organizationId);
  }

  // No @RequirePermissions — every authenticated user in the org can
  // see the same "N of 50 used" fact the create-form's own error
  // would eventually show them anyway; nothing sensitive here.
  @Get("edition-status")
  getEditionStatus(@CurrentUser() user: JwtPayload) {
    return this.organizationsService.getEditionStatus(user.organizationId);
  }

  @Get("campuses")
  @RequirePermissions("campus:view")
  listCampuses(@CurrentUser() user: JwtPayload) {
    return this.organizationsService.listCampuses(user.organizationId);
  }

  @Post("campuses")
  @RequirePermissions("campus:create")
  createCampus(@CurrentUser() user: JwtPayload, @Body() dto: CreateCampusDto) {
    return this.organizationsService.createCampus(user.organizationId, dto);
  }

  @Patch("campuses/:id")
  @RequirePermissions("campus:update")
  updateCampus(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateCampusDto) {
    return this.organizationsService.updateCampus(user.organizationId, id, dto);
  }

  @Delete("campuses/:id")
  @RequirePermissions("campus:delete")
  deleteCampus(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.organizationsService.deleteCampus(user.organizationId, id);
  }
}
