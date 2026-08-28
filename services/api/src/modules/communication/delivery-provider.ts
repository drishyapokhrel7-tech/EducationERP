import { Injectable, Logger } from "@nestjs/common";
import { google } from "googleapis";

export interface DeliveryResult {
  status: "SENT" | "FAILED";
  providerResponse: string;
}

/**
 * Real SMS/push delivery still needs a paid third-party provider
 * (Twilio, Firebase Cloud Messaging, ...) this project has never
 * depended on anywhere, so those two stay log-only stubs — same "no
 * paid API as a hard dependency" rule already applied to AI (plan
 * §2.3).
 *
 * Email is different: this project already has a real, consented
 * Google OAuth2 app (originally for Drive storage,
 * storage/google-drive.storage.ts) reusing the same `googleapis`
 * client, so sending real mail via Gmail costs nothing new — no new
 * dependency, no new third-party account. Set EMAIL_DRIVER="gmail"
 * (plus GMAIL_SENDER_EMAIL and a GOOGLE_REFRESH_TOKEN carrying the
 * gmail.send scope — see scripts/google-get-refresh-token.js) to send
 * for real; any other value (including unset) keeps the original
 * log-only stub behavior. Always resolves, never throws — a Gmail
 * failure (quota, revoked grant, network) becomes a FAILED result,
 * exactly like the stub's own shape, so a delivery hiccup can never
 * break registration, password reset, or a Communication send.
 */
@Injectable()
export class DeliveryProvider {
  private readonly logger = new Logger(DeliveryProvider.name);

  async sendEmail(to: string, subject: string | null, body: string): Promise<DeliveryResult> {
    // NODE_ENV=test bypass — same precedent as CaptchaService — so the
    // e2e suite never hits the real Gmail API or tries to mail fake
    // "@rls-e2e.test" addresses.
    if (process.env.EMAIL_DRIVER === "gmail" && process.env.NODE_ENV !== "test") {
      try {
        const providerResponse = await this.sendViaGmail(to, subject, body);
        return { status: "SENT", providerResponse };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`[gmail] send to ${to} failed: ${message}`);
        return { status: "FAILED", providerResponse: message };
      }
    }
    this.logger.log(`[stub email] to=${to} subject=${subject ?? "(none)"} body.length=${body.length}`);
    return { status: "SENT", providerResponse: "logged (no email provider configured)" };
  }

  sendSms(to: string, body: string): Promise<DeliveryResult> {
    this.logger.log(`[stub sms] to=${to} body.length=${body.length}`);
    return Promise.resolve({ status: "SENT", providerResponse: "logged (no SMS provider configured)" });
  }

  sendPush(userId: string, subject: string | null, body: string): Promise<DeliveryResult> {
    this.logger.log(`[stub push] userId=${userId} subject=${subject ?? "(none)"} body.length=${body.length}`);
    return Promise.resolve({ status: "SENT", providerResponse: "logged (no push provider configured)" });
  }

  // Built fresh per call rather than as an eager field (contrast
  // GoogleDriveStorageDriver's eager `drive` field) — this branch
  // usually isn't taken at all (EMAIL_DRIVER unset in dev/test), so
  // there's no reason to construct an OAuth2 client every process
  // start for something that may never be used.
  private async sendViaGmail(to: string, subject: string | null, body: string): Promise<string> {
    const senderEmail = process.env.GMAIL_SENDER_EMAIL;
    if (!senderEmail) {
      throw new Error("GMAIL_SENDER_EMAIL is not configured");
    }
    const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const gmail = google.gmail({ version: "v1", auth });

    const message = [
      `From: ${senderEmail}`,
      `To: ${to}`,
      `Subject: ${subject ?? "(no subject)"}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      body,
    ].join("\r\n");
    // Gmail's `raw` field is base64url (RFC 4648 §5), not plain
    // base64 — different alphabet (-_ instead of +/) and no padding.
    const raw = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const sent = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
    return sent.data.id ?? "sent";
  }
}
