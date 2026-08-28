import { randomInt } from "crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import * as argon2 from "argon2";
import { PrismaService } from "../../prisma/prisma.service";
import { DeliveryProvider } from "../communication/delivery-provider";

const TTL_MS = 10 * 60 * 1000; // 10 minutes — same as EmailVerificationCode
const CODE_LENGTH = 6;

/**
 * Same self-verification shape and honesty as EmailVerificationService:
 * the reset code is always returned directly in the response and shown
 * on-screen, whether or not real email is configured (see
 * DeliveryProvider.sendEmail's EMAIL_DRIVER=gmail branch) — kept as a
 * fallback/dev convenience, not replaced. This means the person
 * requesting the reset sees the code immediately without proving they
 * own the account's inbox, a real (and deliberate) trade-off given
 * this project's on-screen-first design — the same one the user
 * explicitly chose for email verification.
 *
 * A different trade-off from EmailVerificationService, though:
 * requestReset() throws NotFoundException for an identifier that
 * matches no account, rather than returning a generic "if an account
 * exists..." response. A traditional email-based flow hides this to
 * prevent account enumeration; that only works because the code is
 * invisible to the requester unless they own the inbox. Here the code
 * is shown directly regardless, so pretending success for a
 * nonexistent account would just be a confusing dead end, not a real
 * privacy protection. The forgot-password request itself is
 * captcha-gated (see AuthController) as the actual abuse control.
 */
@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: DeliveryProvider,
  ) {}

  async requestReset(identifier: string): Promise<{ codeId: string; code: string }> {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
    });
    if (!user) {
      throw new NotFoundException("No account found for that User Id");
    }
    const code = randomDigits(CODE_LENGTH);
    const codeHash = await argon2.hash(code);
    const row = await this.prisma.passwordResetCode.create({
      data: { userId: user.id, codeHash, expiresAt: new Date(Date.now() + TTL_MS) },
    });
    // DeliveryProvider never throws (see its own comment) — a
    // delivery hiccup can't turn a valid reset request into a 500.
    await this.delivery.sendEmail(
      user.email,
      "Password reset code",
      `Your password reset code is ${code}. It expires in 10 minutes.`,
    );
    return { codeId: row.id, code };
  }

  async resetPassword(codeId: string | undefined, code: string | undefined, newPassword: string): Promise<void> {
    if (!codeId || !code) {
      throw new BadRequestException("A reset code is required");
    }
    const row = await this.prisma.passwordResetCode.findUnique({ where: { id: codeId } });
    // Same generic failure for "doesn't exist" / "expired" / "already
    // used" / "wrong code" as Captcha/EmailVerificationCode.
    const invalid = new BadRequestException("Incorrect or expired code — request a new one");
    if (!row || row.consumedAt || row.expiresAt < new Date()) {
      throw invalid;
    }
    const correct = await argon2.verify(row.codeHash, code.trim());
    // Mark consumed regardless of outcome — single-use whether or not
    // the attempt was right, same reasoning as Captcha/
    // EmailVerificationCode.
    await this.prisma.passwordResetCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
    if (!correct) {
      throw invalid;
    }

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
      // A password reset invalidates every existing session — if the
      // password was forgotten (or worse, guessed by someone else),
      // whoever is already logged in elsewhere shouldn't stay logged
      // in past this point.
      this.prisma.session.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }
}

function randomDigits(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += randomInt(10);
  return out;
}
