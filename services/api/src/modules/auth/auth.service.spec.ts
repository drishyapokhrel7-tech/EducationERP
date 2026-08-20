import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { UnauthorizedException } from "@nestjs/common";
import * as argon2 from "argon2";
import { AuthService } from "./auth.service";
import { PrismaService } from "../../prisma/prisma.service";

describe("AuthService", () => {
  let authService: AuthService;
  let prisma: {
    user: { findFirst: jest.Mock };
    loginEvent: { create: jest.Mock };
    session: { create: jest.Mock };
    userRole: { findMany: jest.Mock };
  };
  let passwordHash: string;
  const rawPassword = "correct-horse-battery-staple";

  beforeAll(async () => {
    passwordHash = await argon2.hash(rawPassword);
  });

  beforeEach(async () => {
    prisma = {
      user: { findFirst: jest.fn() },
      loginEvent: { create: jest.fn() },
      session: { create: jest.fn() },
      userRole: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue("signed.jwt.token") },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  const baseUser = {
    id: "user-1",
    organizationId: "org-1",
    email: "admin@school.test",
    firstName: "Ada",
    lastName: "Admin",
    status: "ACTIVE" as const,
    passwordHash: "",
  };

  it("logs in with correct credentials and never returns the password hash", async () => {
    prisma.user.findFirst.mockResolvedValue({ ...baseUser, passwordHash });

    const result = await authService.login(
      { identifier: baseUser.email, password: rawPassword },
      {},
    );

    expect(result.user).not.toHaveProperty("passwordHash");
    expect(result.accessToken).toBe("signed.jwt.token");
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(prisma.loginEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ success: true }) }),
    );
  });

  it("rejects an incorrect password and still records the failed attempt", async () => {
    prisma.user.findFirst.mockResolvedValue({ ...baseUser, passwordHash });

    await expect(
      authService.login({ identifier: baseUser.email, password: "wrong-password" }, {}),
    ).rejects.toThrow(UnauthorizedException);

    expect(prisma.loginEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ success: false }) }),
    );
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it("rejects login for a non-ACTIVE user even with the correct password", async () => {
    prisma.user.findFirst.mockResolvedValue({
      ...baseUser,
      passwordHash,
      status: "SUSPENDED",
    });

    await expect(
      authService.login({ identifier: baseUser.email, password: rawPassword }, {}),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("rejects login for an unknown identifier without leaking whether the account exists", async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      authService.login({ identifier: "nobody@school.test", password: rawPassword }, {}),
    ).rejects.toThrow(UnauthorizedException);
  });
});
