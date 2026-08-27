import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { PlatformOrganizationsService } from "./platform-organizations.service";
import { UpdateOrganizationEditionDto } from "./dto/update-organization-edition.dto";
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
  updateEdition(@Param("id") id: string, @Body() dto: UpdateOrganizationEditionDto) {
    return this.platformOrganizations.updateEdition(id, dto);
  }
}
