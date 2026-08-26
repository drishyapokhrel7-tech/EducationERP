import { Body, Controller, Delete, Get, Param, Post, Patch, Query, UseGuards } from "@nestjs/common";
import { RbacService } from "./rbac.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { AssignRoleDto } from "./dto/assign-role.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me")
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  @Get("roles")
  @RequirePermissions("role:view")
  listRoles(@CurrentUser() user: JwtPayload) {
    return this.rbac.listRoles(user.organizationId);
  }

  @Post("roles")
  @RequirePermissions("role:create")
  createRole(@CurrentUser() user: JwtPayload, @Body() dto: CreateRoleDto) {
    return this.rbac.createRole(user.organizationId, user.sub, dto);
  }

  @Patch("roles/:id")
  @RequirePermissions("role:update")
  updateRole(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateRoleDto) {
    return this.rbac.updateRole(user.organizationId, user.sub, id, dto);
  }

  @Delete("roles/:id")
  @RequirePermissions("role:delete")
  deleteRole(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.rbac.deleteRole(user.organizationId, user.sub, id);
  }

  // The global permission catalog — the "master template" every role
  // (system or custom) is built from. Folded under role:view rather
  // than a new resource, same reasoning as financial-transactions
  // folding under invoice:view.
  @Get("permissions")
  @RequirePermissions("role:view")
  listPermissions() {
    return this.rbac.listPermissions();
  }

  @Get("users")
  @RequirePermissions("user:view")
  listUsers(@CurrentUser() user: JwtPayload) {
    return this.rbac.listUsers(user.organizationId);
  }

  @Post("users/:id/roles")
  @RequirePermissions("user:manage")
  assignRole(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: AssignRoleDto) {
    return this.rbac.assignRole(user.organizationId, user.sub, id, dto);
  }

  @Delete("users/:id/roles/:roleId")
  @RequirePermissions("user:manage")
  unassignRole(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Param("roleId") roleId: string) {
    return this.rbac.unassignRole(user.organizationId, user.sub, id, roleId);
  }

  @Get("audit-logs")
  @RequirePermissions("audit_log:view")
  listAuditLogs(
    @CurrentUser() user: JwtPayload,
    @Query("resource") resource?: string,
    @Query("action") action?: string,
    @Query("limit") limit?: string,
  ) {
    return this.rbac.listAuditLogs(user.organizationId, {
      resource,
      action,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
