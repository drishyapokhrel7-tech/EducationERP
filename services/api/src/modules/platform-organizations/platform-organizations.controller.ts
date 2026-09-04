import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { PlatformOrganizationsService } from "./platform-organizations.service";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { PlatformAuthGuard } from "../../common/auth/platform-auth.guard";

@UseGuards(PlatformAuthGuard)
@Controller("platform/organizations")
export class PlatformOrganizationsController {
  constructor(private readonly platformOrganizations: PlatformOrganizationsService) {}

  @Get()
  list() {
    return this.platformOrganizations.listOrganizations();
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateOrganizationDto) {
    return this.platformOrganizations.updateOrganization(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.platformOrganizations.deleteOrganization(id);
  }
}
