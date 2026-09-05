import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { InitiateUpgradeDto } from "./dto/initiate-upgrade.dto";
import { ConfirmUpgradeDto } from "./dto/confirm-upgrade.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

// Deliberately no RequireEditionGuard/@RequireEdition here, unlike
// every other gated module — the whole point of this controller is
// letting a FREE-tier org pay to no longer be FREE-tier; gating it
// behind a paid edition would be circular.
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me/billing")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post("upgrade/initiate")
  @RequirePermissions("organization:manage")
  initiateUpgrade(@CurrentUser() user: JwtPayload, @Body() dto: InitiateUpgradeDto) {
    return this.billing.initiateUpgrade(user.organizationId, user.sub, dto);
  }

  @Post("upgrade/confirm")
  @RequirePermissions("organization:manage")
  confirmUpgrade(@CurrentUser() user: JwtPayload, @Body() dto: ConfirmUpgradeDto) {
    return this.billing.confirmUpgrade(user.organizationId, dto.data);
  }
}
