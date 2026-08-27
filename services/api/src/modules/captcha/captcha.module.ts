import { Module } from "@nestjs/common";
import { CaptchaService } from "./captcha.service";

// No controller of its own — AuthController exposes the one GET
// auth/captcha route (reused by both the tenant and platform login
// pages, since a challenge has no inherent "tenant" or "platform"
// flavor); AuthService and PlatformAuthService both import this
// module to call verify() directly.
@Module({
  providers: [CaptchaService],
  exports: [CaptchaService],
})
export class CaptchaModule {}
