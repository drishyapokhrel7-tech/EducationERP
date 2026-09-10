import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Resolves a user's effective `resource:action` permission set from
// their roles, with a short in-memory cache.
//
// This exists so the access-token JWT no longer has to carry the full
// permission catalogue inline. An Organization Admin's catalogue is
// ~250 entries — the encoded token ran ~18KB, over Node's default
// --max-http-header-size of 16KB, so every authenticated request 431'd
// on any runtime that didn't raise that limit (the whole reason
// services/api/scripts/dev sets NODE_OPTIONS). Now the token carries
// only `sub` + `roles`, and the guard looks permissions up here.
//
// The 30s TTL also makes permission changes take effect faster than
// before: previously a role edit didn't reach a user until their
// 15-minute access token was refreshed.
@Injectable()
export class PermissionResolver {
  private readonly cache = new Map<string, { perms: Set<string>; expires: number }>();
  private readonly TTL_MS = 30_000;

  constructor(private readonly prisma: PrismaService) {}

  async getPermissions(userId: string): Promise<Set<string>> {
    const now = Date.now();
    const hit = this.cache.get(userId);
    if (hit && hit.expires > now) return hit.perms;

    const perms = await this.load(userId);
    this.cache.set(userId, { perms, expires: now + this.TTL_MS });

    if (this.cache.size > 1000) {
      for (const [key, value] of this.cache) if (value.expires <= now) this.cache.delete(key);
    }
    return perms;
  }

  // Call after any role/permission mutation so it doesn't wait out the
  // TTL. Cheap — the cache repopulates lazily on the next request.
  clear(): void {
    this.cache.clear();
  }

  private async load(userId: string): Promise<Set<string>> {
    // This query is now on the auth hot path (every permission-gated
    // request whose cache entry has expired), so it gets the same
    // transient-error tolerance as PrismaService.withTenant — a
    // flaky-Neon blip here would otherwise 500 an otherwise-valid
    // request.
    let userRoles;
    for (let attempt = 1; ; attempt++) {
      try {
        userRoles = await this.prisma.userRole.findMany({
          where: { userId },
          include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
        });
        break;
      } catch (err) {
        const transient =
          (err instanceof Prisma.PrismaClientKnownRequestError && ["P1001", "P2024", "P2028"].includes(err.code)) ||
          err instanceof Prisma.PrismaClientInitializationError;
        if (attempt >= 3 || !transient) throw err;
        await sleep(200 * attempt);
      }
    }
    const perms = new Set<string>();
    for (const userRole of userRoles) {
      for (const rolePermission of userRole.role.rolePermissions) {
        // PermissionAction enum values are uppercase; @RequirePermissions()
        // strings are lowercase resource:action — same lowercasing as
        // AuthService.loadRolesAndPermissions (a mismatch here silently
        // denies everyone).
        perms.add(`${rolePermission.permission.resource}:${rolePermission.permission.action.toLowerCase()}`);
      }
    }
    return perms;
  }
}
