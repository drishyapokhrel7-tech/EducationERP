import { Injectable, Logger } from "@nestjs/common";

export interface DeliveryResult {
  status: "SENT" | "FAILED";
  providerResponse: string;
}

/**
 * Real email/SMS/push delivery needs a paid third-party provider
 * (SendGrid, Twilio, Firebase Cloud Messaging, ...) this project has
 * never depended on anywhere — same "no paid API as a hard
 * dependency" rule already applied to AI (plan §2.3). This is the
 * seam a real provider plugs into later: every call here always
 * "succeeds" and only ever logs the attempt, never touches a real
 * network. Replacing this with a real implementation (or a
 * provider-abstraction with multiple backends, matching the AI
 * service's own pattern) is a clean, separate future step.
 */
@Injectable()
export class DeliveryProvider {
  private readonly logger = new Logger(DeliveryProvider.name);

  // Not actually async (the stub does no real I/O), but kept
  // Promise-returning so a future real provider — which will need
  // await — is a drop-in replacement with no caller changes.
  sendEmail(to: string, subject: string | null, body: string): Promise<DeliveryResult> {
    this.logger.log(`[stub email] to=${to} subject=${subject ?? "(none)"} body.length=${body.length}`);
    return Promise.resolve({ status: "SENT", providerResponse: "logged (no email provider configured)" });
  }

  sendSms(to: string, body: string): Promise<DeliveryResult> {
    this.logger.log(`[stub sms] to=${to} body.length=${body.length}`);
    return Promise.resolve({ status: "SENT", providerResponse: "logged (no SMS provider configured)" });
  }

  sendPush(userId: string, subject: string | null, body: string): Promise<DeliveryResult> {
    this.logger.log(`[stub push] userId=${userId} subject=${subject ?? "(none)"} body.length=${body.length}`);
    return Promise.resolve({ status: "SENT", providerResponse: "logged (no push provider configured)" });
  }
}
