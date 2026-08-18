import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { OrganizationsService } from "./organizations.service";
import { CreateCampusDto } from "./dto/create-campus.dto";
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
}
