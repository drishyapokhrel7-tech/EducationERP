import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { PrismaService } from "../../prisma/prisma.service";
import { PlatformLoginDto } from "./dto/platform-login.dto";
import { PlatformJwtPayload } from "../../common/auth/platform-jwt-payload";
import { CaptchaService } from "../captcha/captcha.service";

const PLATFORM_TOKEN_TTL_SECONDS = 1800; // 30 min — shorter-lived than a tenant session, given how privileged this surface is.

@Injectable()
export class PlatformAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly captcha: CaptchaService,
  ) {}

  async login(dto: PlatformLoginDto) {
    await this.captcha.requireValid(dto.captchaId, dto.captchaAnswer);

    const admin = await this.prisma.platformAdmin.findUnique({ where: { email: dto.email } });
    const valid = admin ? await argon2.verify(admin.passwordHash, dto.password) : false;
    if (!admin || !valid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const secret = this.config.get<string>("PLATFORM_JWT_SECRET");
    if (!secret) {
      throw new Error("PLATFORM_JWT_SECRET is not set");
    }
    const payload: PlatformJwtPayload = { sub: admin.id, type: "platform" };
    const accessToken = await this.jwt.signAsync(payload, { secret, expiresIn: PLATFORM_TOKEN_TTL_SECONDS });

    return {
      admin: { id: admin.id, email: admin.email, name: admin.name },
      accessToken,
      expiresIn: PLATFORM_TOKEN_TTL_SECONDS,
    };
  }
}
