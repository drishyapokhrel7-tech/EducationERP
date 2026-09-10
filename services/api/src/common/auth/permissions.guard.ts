import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "./permissions.decorator";
import { AuthenticatedRequest } from "./authenticated-request";
import { PermissionResolver } from "./permission-resolver";

/**
 * Enforces @RequirePermissions() server-side. Must run after
 * JwtAuthGuard, which populates request.user from a verified token —
 * this guard never trusts anything client-supplied.
 *
 * The access token used to carry the user's full permission list
 * inline; it no longer does (that made the token exceed the default
 * HTTP header size limit). Permissions are resolved from the token's
 * `roles` via PermissionResolver's short-TTL cache. Tokens issued
 * before that change still carry `permissions` — honoured as a
 * fallback so a rollout doesn't 403 anyone mid-session.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException("No authenticated user");
    }

    const granted =
      user.permissions && user.permissions.length > 0
        ? new Set(user.permissions)
        : await this.permissions.getPermissions(user.sub);
    const hasAll = required.every((perm) => granted.has(perm));
    if (!hasAll) {
      throw new ForbiddenException("Insufficient permissions");
    }
    return true;
  }
}
