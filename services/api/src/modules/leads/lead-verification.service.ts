import { randomInt } from "crypto";
import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common";
import * as argon2 from "argon2";
import { PrismaService } from "../../prisma/prisma.service";
import { DeliveryProvider } from "../communication/delivery-provider";

const TTL_MS = 10 * 60 * 1000; // 10 minutes — same as EmailVerificationCode/PasswordResetCode
const CODE_LENGTH = 6;

/**
 * Anti-fake-submission gate for the public leads form (POST
 * /public/leads) — a marketing-site visitor has no account, so this
 * is keyed on the raw submitted email rather than a userId.
 *
 * Deliberately follows PasswordResetService's "email-only, hard-fail
 * if delivery didn't happen" precedent, not EmailVerificationService's
 * on-screen fallback: the entire point of this gate is that only
 * someone with real access to that inbox can complete it. Showing the
 * code on-screen (or returning it in this response) would let a
 * scripted submission read it straight back out and defeat the gate
 * completely — so requestCode() never returns the code outside
 * NODE_ENV=test, and a delivery that didn't actually go out throws
 * loudly instead of a dead-end 200.
 */
@Injectable()
export class LeadVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: DeliveryProvider,
  ) {}

  async requestCode(rawEmail: string): Promise<{ codeId: string; code?: string }> {
    const email = normalizeEmail(rawEmail);
    const code = randomDigits(CODE_LENGTH);
    const codeHash = await argon2.hash(code);
    const row = await this.prisma.leadVerificationCode.create({
      data: { email, codeHash, expiresAt: new Date(Date.now() + TTL_MS) },
    });

    // Test suite can't read a real inbox — same NODE_ENV=test bypass
    // precedent as Captcha/EmailVerification/PasswordReset.
    if (process.env.NODE_ENV === "test") {
      return { codeId: row.id, code };
    }

    const result = await this.delivery.sendEmail(
      email,
      "Your verification code",
      `Your verification code is ${code}. It expires in 10 minutes.`,
    );
    if (process.env.EMAIL_DRIVER !== "gmail" || result.status === "FAILED") {
      // Not "no account exists" (there's no account here to leak) —
      // purely "delivery didn't happen," surfaced loudly rather than
      // a silent success the caller can never act on.
      throw new InternalServerErrorException(
        "Could not send a verification email right now — please try again shortly.",
      );
    }
    return { codeId: row.id };
  }

  async verify(rawEmail: string, codeId: string | undefined, code: string | undefined): Promise<void> {
    if (!codeId || !code) {
      throw new BadRequestException("A verification code is required");
    }
    const email = normalizeEmail(rawEmail);
    const row = await this.prisma.leadVerificationCode.findUnique({ where: { id: codeId } });
    // Same generic failure for "doesn't exist" / "requested for a
    // different email" / "expired" / "already used" / "wrong code" as
    // every other code-verify flow in this project — distinguishing
    // them only helps someone probing, not a real submitter (who just
    // requests a new code).
    const invalid = new BadRequestException("Incorrect or expired code — request a new one");
    if (!row || row.email !== email || row.consumedAt || row.expiresAt < new Date()) {
      throw invalid;
    }
    const correct = await argon2.verify(row.codeHash, code.trim());
    // Mark consumed regardless of outcome — single-use whether or not
    // this attempt was actually correct.
    await this.prisma.leadVerificationCode.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });
    if (!correct) {
      throw invalid;
    }
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function randomDigits(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += randomInt(0, 10).toString();
  return out;
}
