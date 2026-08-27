import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class PlatformLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  // Same optional-at-the-DTO-level, enforced-in-the-service shape as
  // the tenant LoginDto — see CaptchaService.requireValid.
  @IsOptional()
  @IsString()
  captchaId?: string;

  @IsOptional()
  @IsString()
  captchaAnswer?: string;
}
