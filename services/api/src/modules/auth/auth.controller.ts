import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { RegisterOrganizationDto } from "./dto/register-organization.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";
import { CaptchaService } from "../captcha/captcha.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly captchaService: CaptchaService,
  ) {}

  // No auth guard — this happens before login. Reused by both the
  // tenant login page and /platform/login. Rate-limited on top of the
  // global default — repeatedly re-fetching a fresh challenge is
  // itself a captcha-solving-automation signal, not just noise.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get("captcha")
  getCaptcha() {
    return this.captchaService.generate();
  }

  // Rate-limited well below the global default — a brand-new
  // organization is a rare, deliberate action, and this endpoint is
  // the one place a bare POST creates a real tenant + admin account.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("register-organization")
  registerOrganization(@Body() dto: RegisterOrganizationDto) {
    return this.authService.registerOrganization(dto);
  }

  // CAPTCHA already gates a wrong password from even reaching
  // credential comparison — this is a second, independent layer
  // against distributed/slow brute force, not a replacement for it.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("login")
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
  }

  @Post("refresh")
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post("logout")
  logout(@Body() dto: RefreshDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post("me")
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Post("verify-email")
  async verifyEmail(@CurrentUser() user: JwtPayload, @Body() dto: VerifyEmailDto) {
    await this.authService.verifyEmail(user.sub, dto.codeId, dto.code);
    return { verified: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post("resend-verification-code")
  resendVerificationCode(@CurrentUser() user: JwtPayload) {
    return this.authService.resendVerificationCode(user.sub);
  }

  // No auth guard — the whole point is the user is locked out.
  // Main tenant login only (matches the login page's own scope) —
  // student/staff self-service and /platform/login are unaffected.
  // Rate-limited well below the default — also the one place a bare
  // identifier triggers a real email send, so this doubles as spam
  // protection for whoever's inbox that identifier belongs to.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("forgot-password")
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.identifier, dto.captchaId, dto.captchaAnswer);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("reset-password")
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.codeId, dto.code, dto.newPassword);
    return { reset: true };
  }
}
