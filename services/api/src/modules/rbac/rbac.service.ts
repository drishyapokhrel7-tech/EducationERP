import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import { randomInt } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { AssignRoleDto } from "./dto/assign-role.dto";
import { InviteUserDto } from "./dto/invite-user.dto";

// Excludes visually-ambiguous characters (0/O, 1/I/l) — this is typed
// once, by hand, by whoever the admin relays it to.
const PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

// A readable, segmented temp password (e.g. "Xk4p-9mQr-2Ltn") — never
// stored or logged in the clear, and returned from inviteUser() below
// exactly once. Unlike createLogin's admin-typed password (never
// echoed back, per the "never expose a password in a response" rule),
// there is no admin-typed password here to begin with — the server
// has to generate one somewhere, and returning it once, on the one
// response that creates it, is the only way the inviting admin can
// ever learn it at all.
function generateTempPassword(): string {
  const segment = () => Array.from({ length: 4 }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]).join("");
  return `${segment()}-${segment()}-${segment()}`;
}

/**
 * Roles & Permissions admin — "role" and "user" have been reserved
 * RBAC resources (full Super Admin/Organization Admin access already
 * seeded) since Phase 1, with no API ever built on top until now.
 * `Role`/`Permission`/`RolePermission`/`UserRole` are deliberately NOT
 * RLS-covered (same reason `users`/`sessions` aren't — auth's
 * login-by-email has to work before a tenant context exists), so every
 * method here does its own explicit organizationId check rather than
 * relying on withTenant()'s RLS GUC for these specific tables.
 */
@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Roles ─────────────────────────────────────────────────────────

  listRoles(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.role.findMany({
        where: { OR: [{ isSystem: true }, { organizationId }] },
        include: { rolePermissions: { include: { permission: true } } },
        orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      }),
    );
  }

  async createRole(organizationId: string, userId: string, dto: CreateRoleDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const permissions = await tx.permission.findMany({ where: { id: { in: dto.permissionIds } } });
      if (permissions.length !== dto.permissionIds.length) {
        throw new BadRequestException("One or more permissionIds are invalid");
      }
      const existing = await tx.role.findFirst({ where: { organizationId, name: dto.name } });
      if (existing) throw new ConflictException("A role with this name already exists");

      const role = await tx.role.create({
        data: {
          organizationId,
          name: dto.name,
          description: dto.description,
          isSystem: false,
          rolePermissions: { create: dto.permissionIds.map((permissionId) => ({ permissionId })) },
        },
        include: { rolePermissions: { include: { permission: true } } },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          action: "role.created",
          resource: "role",
          resourceId: role.id,
          metadata: { name: role.name, permissionIds: dto.permissionIds },
        },
      });
      return role;
    });
  }

  async updateRole(organizationId: string, userId: string, id: string, dto: UpdateRoleDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const role = await this.loadOwnedCustomRole(tx, organizationId, id);

      if (dto.permissionIds) {
        const permissions = await tx.permission.findMany({ where: { id: { in: dto.permissionIds } } });
        if (permissions.length !== dto.permissionIds.length) {
          throw new BadRequestException("One or more permissionIds are invalid");
        }
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        await tx.rolePermission.createMany({
          data: dto.permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
        });
      }

      const updated = await tx.role.update({
        where: { id },
        data: { name: dto.name ?? role.name, description: dto.description ?? role.description },
        include: { rolePermissions: { include: { permission: true } } },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          action: "role.updated",
          resource: "role",
          resourceId: id,
          metadata: { name: dto.name, description: dto.description, permissionIds: dto.permissionIds },
        },
      });
      return updated;
    });
  }

  async deleteRole(organizationId: string, userId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const role = await this.loadOwnedCustomRole(tx, organizationId, id);

      const assignedCount = await tx.userRole.count({ where: { roleId: id } });
      if (assignedCount > 0) {
        throw new ConflictException(`This role is assigned to ${assignedCount} user(s) — unassign it from them first`);
      }

      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.role.delete({ where: { id } });
      await tx.auditLog.create({
        data: { organizationId, userId, action: "role.deleted", resource: "role", resourceId: id, metadata: { name: role.name } },
      });
      return { deleted: true };
    });
  }

  private async loadOwnedCustomRole(tx: PrismaClient, organizationId: string, id: string) {
    const role = await tx.role.findUnique({ where: { id } });
    if (!role || role.isSystem || role.organizationId !== organizationId) {
      throw new NotFoundException("Role not found");
    }
    return role;
  }

  // ── Permissions catalog (the "master template") ─────────────────────

  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: [{ resource: "asc" }, { action: "asc" }] });
  }

  // ── Users ─────────────────────────────────────────────────────────

  listUsers(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.user.findMany({
        where: { organizationId, deletedAt: null },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          status: true,
          createdAt: true,
          userRoles: { include: { role: true } },
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      }),
    );
  }

  // Creates a brand-new teammate with a real email and a system-
  // generated temp password, no email delivery attempted at all (this
  // project's Gmail sending is currently unreliable — rather than
  // depending on it like PasswordResetService now does, this follows
  // EmailVerificationService's more robust precedent of showing the
  // credential on-screen regardless of whether email could ever work).
  // Used both by the post-signup "invite your team" onboarding step
  // and this page's own permanent "Invite user" form — same endpoint,
  // two entry points.
  async inviteUser(organizationId: string, actorUserId: string, dto: InviteUserDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: dto.email } });
      if (existing) throw new ConflictException("Email already registered");

      const role = await tx.role.findUnique({ where: { id: dto.roleId } });
      if (!role || (!role.isSystem && role.organizationId !== organizationId)) {
        throw new NotFoundException("Role not found");
      }

      const tempPassword = generateTempPassword();
      const passwordHash = await argon2.hash(tempPassword);

      const user = await tx.user.create({
        data: {
          organizationId,
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          status: "ACTIVE",
          userRoles: { create: { roleId: dto.roleId } },
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          userId: actorUserId,
          action: "user.invited",
          resource: "user",
          resourceId: user.id,
          metadata: { email: dto.email, roleId: dto.roleId, roleName: role.name },
        },
      });

      const { passwordHash: _passwordHash, ...safeUser } = user;
      return { user: safeUser, tempPassword };
    });
  }

  async assignRole(organizationId: string, actorUserId: string, targetUserId: string, dto: AssignRoleDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const user = await tx.user.findUnique({ where: { id: targetUserId } });
      if (!user || user.organizationId !== organizationId) throw new NotFoundException("User not found");

      const role = await tx.role.findUnique({ where: { id: dto.roleId } });
      if (!role || (!role.isSystem && role.organizationId !== organizationId)) {
        throw new NotFoundException("Role not found");
      }

      if (dto.campusId) {
        const campus = await tx.campus.findUnique({ where: { id: dto.campusId } });
        if (!campus || campus.organizationId !== organizationId) throw new NotFoundException("Campus not found");
      }

      const existing = await tx.userRole.findFirst({
        where: { userId: targetUserId, roleId: dto.roleId, campusId: dto.campusId ?? null },
      });
      if (existing) throw new ConflictException("This role is already assigned to this user");

      const userRole = await tx.userRole.create({
        data: { userId: targetUserId, roleId: dto.roleId, campusId: dto.campusId },
        include: { role: true },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          userId: actorUserId,
          action: "user.role_assigned",
          resource: "user",
          resourceId: targetUserId,
          metadata: { roleId: dto.roleId, roleName: role.name, campusId: dto.campusId },
        },
      });
      return userRole;
    });
  }

  async unassignRole(organizationId: string, actorUserId: string, targetUserId: string, roleId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const user = await tx.user.findUnique({ where: { id: targetUserId } });
      if (!user || user.organizationId !== organizationId) throw new NotFoundException("User not found");

      const userRole = await tx.userRole.findFirst({ where: { userId: targetUserId, roleId } });
      if (!userRole) throw new NotFoundException("This role is not assigned to this user");

      await tx.userRole.delete({ where: { id: userRole.id } });
      await tx.auditLog.create({
        data: {
          organizationId,
          userId: actorUserId,
          action: "user.role_unassigned",
          resource: "user",
          resourceId: targetUserId,
          metadata: { roleId },
        },
      });
      return { unassigned: true };
    });
  }

  // ── Audit log ─────────────────────────────────────────────────────

  listAuditLogs(organizationId: string, filters: { resource?: string; action?: string; limit?: number }) {
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 200);
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.auditLog.findMany({
        where: {
          organizationId,
          resource: filters.resource,
          action: filters.action,
        },
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
    );
  }
}
