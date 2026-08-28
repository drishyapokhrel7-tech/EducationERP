import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { EmailVerificationService } from "./email-verification.service";
import { PasswordResetService } from "./password-reset.service";
import { JwtStrategy } from "../../common/auth/jwt.strategy";
import { CaptchaModule } from "../captcha/captcha.module";
import { CommunicationModule } from "../communication/communication.module";

@Module({
  imports: [
    CaptchaModule,
    // Exports DeliveryProvider — EmailVerificationService and
    // PasswordResetService inject it to optionally send real email
    // (see delivery-provider.ts).
    CommunicationModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_ACCESS_SECRET"),
        signOptions: { expiresIn: Number(config.get<string>("JWT_ACCESS_TTL_SECONDS")) || 900 },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, EmailVerificationService, PasswordResetService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
