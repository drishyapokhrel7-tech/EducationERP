import { Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { PlatformAuthService } from "./platform-auth.service";
import { PlatformLoginDto } from "./dto/platform-login.dto";

@Controller("platform/auth")
export class PlatformAuthController {
  constructor(private readonly platformAuth: PlatformAuthService) {}

  // Same defense-in-depth reasoning as the tenant login's own
  // @Throttle (auth.controller.ts) — this is the one credential a
  // successful attempt against would expose every organization's
  // data, not just one tenant's.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("login")
  login(@Body() dto: PlatformLoginDto) {
    return this.platformAuth.login(dto);
  }
}
