import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PlatformJwtPayload } from "./platform-jwt-payload";

// A second, entirely separate Passport strategy (named "platform-jwt",
// not the default "jwt") signed with its own PLATFORM_JWT_SECRET —
// deliberate extra isolation from the tenant JwtStrategy, so a
// platform token and a tenant token can never be cross-accepted even
// if a guard were ever miswired, not relying on the `type` claim
// alone (though that's checked too, in validate() below).
@Injectable()
export class PlatformJwtStrategy extends PassportStrategy(Strategy, "platform-jwt") {
  constructor(config: ConfigService) {
    const secret = config.get<string>("PLATFORM_JWT_SECRET");
    if (!secret) {
      throw new Error("PLATFORM_JWT_SECRET is not set");
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: PlatformJwtPayload): PlatformJwtPayload {
    if (payload.type !== "platform") {
      throw new UnauthorizedException("Not a platform admin token");
    }
    return payload;
  }
}
