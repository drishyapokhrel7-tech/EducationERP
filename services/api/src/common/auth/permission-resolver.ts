import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

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
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    });
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
