import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { PlatformJwtPayload } from "./platform-jwt-payload";

export const CurrentPlatformAdmin = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): PlatformJwtPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: PlatformJwtPayload }>();
    return request.user;
  },
);
