import { BadRequestException, Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
// svg-captcha has no `esModuleInterop`-friendly default export (same
// situation as pdfkit in the analytics module) — a namespace import,
// same pattern already used for exceljs.
import * as svgCaptcha from "svg-captcha";
import { PrismaService } from "../../prisma/prisma.service";

const TTL_MS = 2 * 60 * 1000;

/**
 * Self-hosted human-verification challenge — not a third-party
 * service (reCAPTCHA/hCaptcha/Turnstile), matching this project's
 * standing "no external API as a hard dependency" precedent already
 * applied to AI and maps. Gates /auth/login and /platform/auth/login
 * (both call verify() before any credential check — a wrong or
 * expired/reused CAPTCHA never even attempts a password lookup).
 *
 * Persisted in Postgres, not in-process memory: this project has a
 * serverless deployment path (services/api/api/index.ts) where an
 * in-memory Map wouldn't survive between invocations.
 */
@Injectable()
export class CaptchaService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(): Promise<{ captchaId: string; svg: string }> {
    const captcha = svgCaptcha.create({
      size: 5,
      noise: 3,
      color: true,
      ignoreChars: "0oOlI1", // visually ambiguous characters
    });
    // Not tenant data — no withTenant/organizationId, same as every
    // other genuinely global table in this schema.
    const answerHash = await argon2.hash(normalize(captcha.text));
    const row = await this.prisma.captcha.create({
      data: { answer: answerHash, expiresAt: new Date(Date.now() + TTL_MS) },
    });
    return { captchaId: row.id, svg: captcha.data };
  }

  // The single entry point both AuthService.login and
  // PlatformAuthService.login actually call — folds in the two
  // deliberate bypasses so neither caller has to re-implement this
  // logic:
  //  - NODE_ENV=test (Jest's own default for every test:e2e run):
  //    the whole tenant-isolation.e2e-spec.ts file logs in
  //    programmatically dozens of times and structurally cannot solve
  //    an image challenge. Production is never affected by this — it
  //    only ever runs with NODE_ENV=production/development.
  //  - DISABLE_CAPTCHA=true: an explicit, off-by-default opt-out for a
  //    developer's own local interactive testing convenience. Local
  //    dev keeps CAPTCHA on by default so manual testing matches
  //    production behavior.
  async requireValid(captchaId: string | undefined, answer: string | undefined): Promise<void> {
    if (process.env.NODE_ENV === "test" || process.env.DISABLE_CAPTCHA === "true") {
      return;
    }
    await this.verify(captchaId, answer);
  }

  async verify(captchaId: string | undefined, answer: string | undefined): Promise<void> {
    if (!captchaId || !answer) {
      throw new BadRequestException("A captcha response is required");
    }
    const row = await this.prisma.captcha.findUnique({ where: { id: captchaId } });
    // Same generic failure for "doesn't exist" / "expired" / "already
    // used" / "wrong answer" — distinguishing them for the caller
    // would only help someone probing the mechanism, not a real user
    // (who just clicks refresh and tries again).
    const invalid = new BadRequestException("Incorrect or expired captcha — please try again");
    if (!row || row.consumedAt || row.expiresAt < new Date()) {
      throw invalid;
    }
    const correct = await argon2.verify(row.answer, normalize(answer));
    // Mark consumed regardless of outcome — a captcha is single-use
    // whether or not the attempt was right, closing off repeated
    // guesses against the same rendered challenge.
    await this.prisma.captcha.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
    if (!correct) {
      throw invalid;
    }
  }
}

// Distorted text is hard to read exact-case — comparing
// case-insensitively (and trimming incidental whitespace) is fairer
// to a real human without weakening the check against a script, which
// still has to actually solve the rendered image either way.
function normalize(text: string): string {
  return text.trim().toLowerCase();
}
