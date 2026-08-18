import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { JwtPayload } from "./jwt-payload";
import { AuthenticatedRequest } from "./authenticated-request";

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
