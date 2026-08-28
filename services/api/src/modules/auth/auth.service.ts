import { randomBytes, createHash } from "crypto";
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { PrismaService } from "../../prisma/prisma.service";
import { RegisterOrganizationDto } from "./dto/register-organization.dto";
import { LoginDto } from "./dto/login.dto";
import { JwtPayload } from "../../common/auth/jwt-payload";
import { CaptchaService } from "../captcha/captcha.service";
import { EmailVerificationService } from "./email-verification.service";
import { PasswordResetService } from "./password-reset.service";
import { DEFAULT_STAFF_TYPES, DEFAULT_DESIGNATIONS } from "../staff/staff.service";

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly captcha: CaptchaService,
    private readonly emailVerification: EmailVerificationService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  async registerOrganization(dto: RegisterOrganizationDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.adminEmail } });
    if (existing) {
      throw new ConflictException("Email already registered");
    }
    const existingSlug = await this.prisma.organization.findUnique({ where: { slug: dto.slug } });
    if (existingSlug) {
      throw new ConflictException("Organization slug already in use");
    }

    const adminRole = await this.prisma.role.findFirst({
      where: { isSystem: true, name: "Organization Admin" },
    });
    if (!adminRole) {
      throw new Error("System roles are not seeded — run prisma:seed first");
    }

    const passwordHash = await argon2.hash(dto.password);

    const { user, organization } = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: dto.organizationName, slug: dto.slug },
      });
      // audit_logs is RLS-protected (WITH CHECK organizationId = the
      // session GUC) — the org didn't exist to scope to until the
      // create above, so the GUC is set here, mid-transaction, right
      // before the first RLS-protected write.
      await tx.$executeRawUnsafe(
        `select set_config('app.current_organization_id', $1, true)`,
        organization.id,
      );
      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          email: dto.adminEmail,
          passwordHash,
          firstName: dto.adminFirstName,
          lastName: dto.adminLastName,
          status: "ACTIVE",
          userRoles: { create: { roleId: adminRole.id } },
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          action: "organization.created",
          resource: "organization",
          resourceId: organization.id,
        },
      });
      // Starting-point catalog data, not a fixed set — the admin can
      // rename/remove/add to these freely afterward (StaffType/
      // Designation are both fully editable, see StaffService). See
      // DEFAULT_STAFF_TYPES/DEFAULT_DESIGNATIONS' own comments.
      await tx.staffType.createMany({
        data: DEFAULT_STAFF_TYPES.map((t) => ({ ...t, organizationId: organization.id })),
      });
      await tx.designation.createMany({
        data: DEFAULT_DESIGNATIONS.map((d) => ({ ...d, organizationId: organization.id })),
      });
      return { user, organization };
    });

    const tokens = await this.issueTokens(user.id, organization.id);
    // Account is fully active immediately — verification is a
    // non-blocking, after-the-fact step, not a login gate. No real
    // email provider exists in this project (see
    // EmailVerificationService's own comment), so the code is
    // returned directly here and shown on-screen rather than sent.
    const emailVerification = await this.emailVerification.generate(user.id);
    return { organization, user: this.toSafeUser(user), ...tokens, emailVerification };
  }

  async verifyEmail(userId: string, codeId: string | undefined, code: string | undefined) {
    await this.emailVerification.verify(userId, codeId, code);
  }

  async resendVerificationCode(userId: string) {
    return this.emailVerification.generate(userId);
  }

  // Unauthenticated by nature (the whole point is the user is locked
  // out) — captcha-gated the same way login is, since this is also an
  // unauthenticated endpoint that looks up an account by identifier.
  async forgotPassword(identifier: string, captchaId: string | undefined, captchaAnswer: string | undefined) {
    await this.captcha.requireValid(captchaId, captchaAnswer);
    return this.passwordReset.requestReset(identifier);
  }

  async resetPassword(codeId: string | undefined, code: string | undefined, newPassword: string) {
    await this.passwordReset.resetPassword(codeId, code, newPassword);
  }

  async login(dto: LoginDto, meta: { ipAddress?: string; userAgent?: string }) {
    // Before any credential lookup — a wrong/missing/expired/reused
    // captcha never even attempts a password check. See
    // CaptchaService.requireValid for the NODE_ENV=test /
    // DISABLE_CAPTCHA bypasses this deliberately allows.
    await this.captcha.requireValid(dto.captchaId, dto.captchaAnswer);

    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.identifier }, { username: dto.identifier }] },
    });
    const valid = user ? await argon2.verify(user.passwordHash, dto.password) : false;

    await this.prisma.loginEvent.create({
      data: {
        organizationId: user?.organizationId,
        userId: user?.id,
        email: dto.identifier,
        success: valid,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    if (!user || !valid) {
      throw new UnauthorizedException("Invalid credentials");
    }
    if (user.status !== "ACTIVE") {
      throw new UnauthorizedException("Account is not active");
    }

    const tokens = await this.issueTokens(user.id, user.organizationId, meta);
    return { user: this.toSafeUser(user), ...tokens };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.session.findFirst({
      where: { refreshTokenHash: tokenHash, revokedAt: null },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(session.userId, session.user.organizationId);
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.session.updateMany({
      where: { refreshTokenHash: tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(
    userId: string,
    organizationId: string,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ): Promise<AuthTokens> {
    const { roles, permissions } = await this.loadRolesAndPermissions(userId);

    const payload: JwtPayload = { sub: userId, organizationId, roles, permissions };
    const accessTtlSeconds = Number(this.config.get<string>("JWT_ACCESS_TTL_SECONDS")) || 900;
    const accessToken = await this.jwt.signAsync(
      payload as unknown as Record<string, unknown>,
      { expiresIn: accessTtlSeconds },
    );

    const refreshToken = randomBytes(48).toString("hex");
    await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    return { accessToken, refreshToken, expiresIn: accessTtlSeconds };
  }

  private async loadRolesAndPermissions(userId: string) {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    });

    const roles = new Set<string>();
    const permissions = new Set<string>();
    for (const userRole of userRoles) {
      roles.add(userRole.role.name);
      for (const rolePermission of userRole.role.rolePermissions) {
        // PermissionAction enum values are uppercase (CREATE, VIEW, ...);
        // @RequirePermissions() decorators use lowercase resource:action
        // strings, so this lowercases to match — a casing mismatch here
        // silently denies everyone (caught by the tenant-isolation e2e
        // test: campus creation returned 403 instead of 201).
        const action = rolePermission.permission.action.toLowerCase();
        permissions.add(`${rolePermission.permission.resource}:${action}`);
      }
    }
    return { roles: [...roles], permissions: [...permissions] };
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private toSafeUser(user: { passwordHash: string; [key: string]: unknown }) {
    const { passwordHash: _passwordHash, ...safe } = user;
    return safe;
  }
}
