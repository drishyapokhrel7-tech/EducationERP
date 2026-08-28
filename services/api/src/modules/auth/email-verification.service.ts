import { randomInt } from "crypto";
import { BadRequestException, Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import { PrismaService } from "../../prisma/prisma.service";

const TTL_MS = 10 * 60 * 1000; // 10 minutes — longer than Captcha's 2min
// since the user has to read and re-type a code, not solve an image
// mid-transaction.
const CODE_LENGTH = 6;

/**
 * Self-verification for a newly-registered account's email address —
 * NOT proof of inbox ownership. This project has no real email
 * provider anywhere (see communication/delivery-provider.ts's own
 * "logged, no email provider configured" stub) and, matching the
 * standing "no external API as a hard dependency" precedent already
 * applied to AI/maps/CAPTCHA, doesn't add one here either: the code is
 * returned directly in the registration response and shown on-screen,
 * not emailed. The UI is explicit about this so it never reads as a
 * real security claim.
 *
 * Otherwise the exact same shape as CaptchaService: Postgres-backed
 * (this project's serverless deployment path rules out in-memory),
 * single-use, expiring, argon2-hashed, generic-failure verify.
 */
@Injectable()
export class EmailVerificationService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(userId: string): Promise<{ codeId: string; code: string }> {
    const code = randomDigits(CODE_LENGTH);
    const codeHash = await argon2.hash(code);
    const row = await this.prisma.emailVerificationCode.create({
      data: { userId, codeHash, expiresAt: new Date(Date.now() + TTL_MS) },
    });
    return { codeId: row.id, code };
  }

  async verify(userId: string, codeId: string | undefined, code: string | undefined): Promise<void> {
    if (!codeId || !code) {
      throw new BadRequestException("A verification code is required");
    }
    const row = await this.prisma.emailVerificationCode.findUnique({ where: { id: codeId } });
    // Same generic failure for "doesn't exist" / "belongs to another
    // user" / "expired" / "already used" / "wrong code" as Captcha —
    // distinguishing them would only help someone probing, not a real
    // user (who just requests a new code).
    const invalid = new BadRequestException("Incorrect or expired code — request a new one");
    if (!row || row.userId !== userId || row.consumedAt || row.expiresAt < new Date()) {
      throw invalid;
    }
    const correct = await argon2.verify(row.codeHash, code.trim());
    // Mark consumed regardless of outcome — single-use whether or not
    // the attempt was right, same reasoning as Captcha.
    await this.prisma.emailVerificationCode.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });
    if (!correct) {
      throw invalid;
    }
    await this.prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  }
}

function randomDigits(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += randomInt(10);
  return out;
}
