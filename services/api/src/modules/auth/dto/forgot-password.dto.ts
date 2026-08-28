import { IsOptional, IsString, MinLength } from "class-validator";

export class ForgotPasswordDto {
  @IsString()
  @MinLength(1)
  identifier!: string;

  // Same captcha protection as login, and the same "optional at the
  // DTO level, enforced by AuthService.forgotPassword → CaptchaService
  // (skipped only under NODE_ENV=test)" split as LoginDto — this is an
  // unauthenticated, user-lookup endpoint, so it needs the same abuse
  // control.
  @IsOptional()
  @IsString()
  captchaId?: string;

  @IsOptional()
  @IsString()
  captchaAnswer?: string;
}
