import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { DeviceGatewayService } from "./device-gateway.service";
import { RegisterDeviceDto } from "./dto/register-device.dto";
import { ScanDto } from "./dto/scan.dto";
import { BindCardDto } from "./dto/bind-card.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me/gateway")
export class DeviceGatewayController {
  constructor(private readonly deviceGateway: DeviceGatewayService) {}

  @Post("devices")
  @RequirePermissions("gateway_device:create")
  registerDevice(@CurrentUser() user: JwtPayload, @Body() dto: RegisterDeviceDto) {
    return this.deviceGateway.registerDevice(user.organizationId, dto);
  }

  @Get("devices")
  @RequirePermissions("gateway_device:view")
  listDevices(@CurrentUser() user: JwtPayload) {
    return this.deviceGateway.listDevices(user.organizationId);
  }

  // The scan-ingestion endpoint, same "adapter-agnostic" shape as
  // camera-events' ingestEvent — reuses gateway_device:create since
  // this is the one write action a scan-in station actually performs.
  @Post("devices/:id/scan")
  @RequirePermissions("gateway_device:create")
  scan(@CurrentUser() user: JwtPayload, @Param("id") deviceId: string, @Body() dto: ScanDto) {
    return this.deviceGateway.scan(user.organizationId, deviceId, dto);
  }

  @Post("card-bindings")
  @RequirePermissions("gateway_device:create")
  bindCard(@CurrentUser() user: JwtPayload, @Body() dto: BindCardDto) {
    return this.deviceGateway.bindCard(user.organizationId, user.sub, dto);
  }

  @Get("scan-events")
  @RequirePermissions("gateway_device:view")
  listScanEvents(@CurrentUser() user: JwtPayload) {
    return this.deviceGateway.listScanEvents(user.organizationId);
  }
}
