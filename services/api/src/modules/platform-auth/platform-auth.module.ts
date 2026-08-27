import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { PlatformAuthService } from "./platform-auth.service";
import { PlatformAuthController } from "./platform-auth.controller";
import { PlatformJwtStrategy } from "../../common/auth/platform-jwt.strategy";
import { CaptchaModule } from "../captcha/captcha.module";

@Module({
  imports: [
    PassportModule,
    // No default secret registered — PlatformAuthService always
    // passes PLATFORM_JWT_SECRET explicitly on sign(), the same
    // secret PlatformJwtStrategy verifies against. Deliberately never
    // shares JwtModule's registration with the tenant AuthModule.
    JwtModule.register({}),
    CaptchaModule,
  ],
  providers: [PlatformAuthService, PlatformJwtStrategy],
  controllers: [PlatformAuthController],
})
export class PlatformAuthModule {}
