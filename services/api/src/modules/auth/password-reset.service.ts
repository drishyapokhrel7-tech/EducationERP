import { randomInt } from "crypto";
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import * as argon2 from "argon2";
import { PrismaService } from "../../prisma/prisma.service";
import { DeliveryProvider } from "../communication/delivery-provider";

const TTL_MS = 10 * 60 * 1000; // 10 minutes — same as EmailVerificationCode
const CODE_LENGTH = 6;

/**
 * Email-only now that real Gmail delivery exists (see
 * DeliveryProvider.sendEmail's EMAIL_DRIVER=gmail branch) — a
 * deliberate change from this service's earlier on-screen-code
 * design. requestReset() no longer returns the raw code to the
 * caller in real use; it's only ever delivered by email now, which
 * actually proves inbox ownership. The one exception is
 * NODE_ENV=test: the e2e suite can't check a real inbox, so the code
 * is still returned there — same escape-hatch precedent as
 * CaptchaService/DeliveryProvider's own test bypass.
 *
 * Because there's no on-screen fallback anymore, a delivery that
 * didn't actually go out (EMAIL_DRIVER isn't "gmail", or the send
 * itself failed) is a real dead end for the requester — this throws
 * loudly in that case instead of returning a silent "success" no one
 * can act on.
 *
 * Still keeps its own trade-off from before: requestReset() throws
 * NotFoundException for an identifier that matches no account, rather
 * than a generic "if an account exists..." response. That's a
 * deliberate, separate call (the forgot-password request itself is
 * captcha-gated — see AuthController — as the actual abuse control),
 * unrelated to the email-only change above.
 */
@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: DeliveryProvider,
  ) {}

  async requestReset(identifier: string): Promise<{ codeId: string; code?: string }> {
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

    // Test suite can't read a real inbox — same NODE_ENV=test bypass
    // precedent as Captcha/DeliveryProvider. Every other caller only
    // gets the code via email from here on.
    if (process.env.NODE_ENV === "test") {
      return { codeId: row.id, code };
    }

    const result = await this.delivery.sendEmail(
      user.email,
      "Password reset code",
      `Your password reset code is ${code}. It expires in 10 minutes.`,
    );
    if (process.env.EMAIL_DRIVER !== "gmail" || result.status === "FAILED") {
      // Doesn't leak account existence — the 404 above already
      // settled that boundary. This is purely "delivery didn't
      // happen," surfaced loudly instead of a dead-end 200.
      throw new InternalServerErrorException(
        "Couldn't send the reset email — please try again shortly, or contact your administrator.",
      );
    }
    return { codeId: row.id };
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
