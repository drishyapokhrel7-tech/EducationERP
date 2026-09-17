import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { PlatformMarketingService } from "./platform-marketing.service";
import { CreateMarketingPartnerDto } from "./dto/create-marketing-partner.dto";
import { UpdateMarketingPartnerDto } from "./dto/update-marketing-partner.dto";
import { ListCommissionsQueryDto } from "./dto/list-commissions-query.dto";
import { MarkCommissionPaidDto } from "./dto/mark-commission-paid.dto";
import { PlatformAuthGuard } from "../../common/auth/platform-auth.guard";
import { CurrentPlatformAdmin } from "../../common/auth/current-platform-admin.decorator";
import type { PlatformJwtPayload } from "../../common/auth/platform-jwt-payload";

@UseGuards(PlatformAuthGuard)
@Controller("platform/marketing")
export class PlatformMarketingController {
  constructor(private readonly marketing: PlatformMarketingService) {}

  @Get("partners")
  listPartners() {
    return this.marketing.listPartners();
  }

  @Post("partners")
  createPartner(@Body() dto: CreateMarketingPartnerDto) {
    return this.marketing.createPartner(dto);
  }

  @Patch("partners/:id")
  updatePartner(@Param("id") id: string, @Body() dto: UpdateMarketingPartnerDto) {
    return this.marketing.updatePartner(id, dto);
  }

  @Get("commissions")
  listCommissions(@Query() query: ListCommissionsQueryDto) {
    return this.marketing.listCommissions(query);
  }

  @Patch("commissions/:id/mark-paid")
  markCommissionPaid(
    @Param("id") id: string,
    @Body() dto: MarkCommissionPaidDto,
    @CurrentPlatformAdmin() admin: PlatformJwtPayload,
  ) {
    return this.marketing.markCommissionPaid(id, admin.sub, dto);
  }
}
