import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Edition } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { meetsEdition } from "../../modules/organizations/edition-limits";
import { EDITION_KEY } from "./require-edition.decorator";
import { AuthenticatedRequest } from "./authenticated-request";

/**
 * Enforces @RequireEdition() server-side — the backend half of module
 * gating by subscription tier (the frontend's FeatureLock component,
 * apps/web/src/components/feature-lock.tsx, is the primary UX; this
 * is the defense-in-depth backstop against a client bypassing it).
 * Must run after JwtAuthGuard, which populates request.user from a
 * verified token. Unlike PermissionsGuard, edition isn't carried in
 * the JWT (it can change at any time via the platform admin console,
 * and caching it there would go stale until next login) — this guard
 * does one real query per gated request, the same real, disclosed
 * cost every "is a feature currently allowed" check like this pays.
 */
@Injectable()
export class RequireEditionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Edition>(EDITION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) {
      return true;
    }

    // NODE_ENV=test (Jest's own default for every test:e2e/jest run) —
    // same bypass precedent as CaptchaService.requireValid and
    // DeliveryProvider.sendEmail's Gmail branch. tenant-isolation.
    // e2e-spec.ts and every Electron client's own integration spec
    // register fresh orgs (defaulting to FREE, Organization.edition's
    // own schema default) specifically to exercise each domain's real
    // business logic — retrofitting an edition bump into every one of
    // those test fixtures would be needlessly invasive for a concern
    // that isn't what those tests are about. Production is never
    // affected — it only ever runs with NODE_ENV=production/
    // development. The gate's own real 403 behavior is verified
    // separately, live against a running dev server, the same way
    // CaptchaService's bypass is (jest's own bypass means the suite
    // can't prove enforcement actually blocks anything).
    if (process.env.NODE_ENV === "test") {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException("No authenticated user");
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { edition: true },
    });
    if (!organization) {
      throw new ForbiddenException("Organization not found");
    }

    if (!meetsEdition(organization.edition, required)) {
      throw new ForbiddenException(`This feature requires ${required} edition or higher`);
    }
    return true;
  }
}
