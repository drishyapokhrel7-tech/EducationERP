import { IsOptional, IsString, MinLength } from "class-validator";

export class LoginDto {
  // Either a User.email or a User.username (self-service logins, e.g.
  // students, log in by username — not every login is email-shaped, so
  // this can't be @IsEmail()).
  @IsString()
  @MinLength(1)
  identifier!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  // Verified before any credential check — see CaptchaService.
  // Optional at the DTO level (AuthService.login is where "must be
  // present" is actually enforced, skipped only under NODE_ENV=test —
  // see that method) so this stays a validation-layer concern, not a
  // request-shape one; every real interactive login sends both.
  @IsOptional()
  @IsString()
  captchaId?: string;

  @IsOptional()
  @IsString()
  captchaAnswer?: string;
}
