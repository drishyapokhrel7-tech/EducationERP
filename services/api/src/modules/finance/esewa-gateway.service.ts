import { Injectable } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";

export interface EsewaFormPayload {
  actionUrl: string;
  fields: Record<string, string>;
}

export type EsewaApiStatus =
  | "PENDING"
  | "COMPLETE"
  | "FULL_REFUND"
  | "PARTIAL_REFUND"
  | "AMBIGUOUS"
  | "NOT_FOUND"
  | "CANCELED";

export interface EsewaStatusResult {
  status: EsewaApiStatus;
  refId: string | null;
}

export interface EsewaRedirectPayload {
  transaction_code?: string;
  status?: string;
  total_amount?: string | number;
  transaction_uuid?: string;
  product_code?: string;
  signed_field_names?: string;
  signature?: string;
  [key: string]: unknown;
}

/**
 * Thin protocol wrapper for eSewa's ePay v2 gateway (slice 7a-2) — HMAC
 * signing, redirect-payload signature verification, and the real
 * server-to-server status check. Sandbox defaults (EPAYTEST + the
 * published test secret key) are baked in so this works out of the box
 * in dev, matching AiGatewayService's AI_SERVICE_URL fallback
 * precedent; override via env once real merchant credentials exist.
 *
 * This service never decides whether to credit an invoice — checkStatus
 * is the authoritative signal, and FinanceService is the only place
 * that acts on it. verifySignature is defense-in-depth (tamper
 * evidence), not the security boundary: eSewa's own JSON number
 * formatting in the redirect payload isn't byte-for-bit guaranteed to
 * match what was originally signed, so a failed check here must never
 * be the sole reason to reject — nor may a passing one be the sole
 * reason to credit. Only a real checkStatus() === "COMPLETE" credits
 * money, because that's a live call back to eSewa's own server keyed
 * by transaction_uuid, which a forged redirect cannot fake.
 */
@Injectable()
export class EsewaGatewayService {
  private get productCode(): string {
    return process.env.ESEWA_PRODUCT_CODE ?? "EPAYTEST";
  }

  private get secretKey(): string {
    return process.env.ESEWA_SECRET_KEY ?? "8gBm/:&EnhH.1/q";
  }

  private get gatewayUrl(): string {
    return process.env.ESEWA_GATEWAY_URL ?? "https://rc-epay.esewa.com.np/api/epay/main/v2/form";
  }

  private get statusUrl(): string {
    return process.env.ESEWA_STATUS_URL ?? "https://rc.esewa.com.np/api/epay/transaction/status/";
  }

  private sign(fields: Record<string, unknown>, fieldNames: string[]): string {
    const message = fieldNames.map((name) => `${name}=${String(fields[name])}`).join(",");
    return createHmac("sha256", this.secretKey).update(message).digest("base64");
  }

  buildPaymentForm(params: {
    amount: number;
    transactionUuid: string;
    successUrl: string;
    failureUrl: string;
  }): EsewaFormPayload {
    const totalAmount = params.amount.toFixed(2);
    const signedFieldNames = ["total_amount", "transaction_uuid", "product_code"];
    const signature = this.sign(
      { total_amount: totalAmount, transaction_uuid: params.transactionUuid, product_code: this.productCode },
      signedFieldNames,
    );

    return {
      actionUrl: this.gatewayUrl,
      fields: {
        amount: totalAmount,
        tax_amount: "0",
        total_amount: totalAmount,
        transaction_uuid: params.transactionUuid,
        product_code: this.productCode,
        product_service_charge: "0",
        product_delivery_charge: "0",
        success_url: params.successUrl,
        failure_url: params.failureUrl,
        signed_field_names: signedFieldNames.join(","),
        signature,
      },
    };
  }

  /** Best-effort tamper check, verified against the payload's own claimed field values — not the security boundary, see class doc. */
  verifySignature(payload: EsewaRedirectPayload): boolean {
    if (!payload.signed_field_names || !payload.signature) return false;
    const fieldNames = payload.signed_field_names.split(",");
    const expected = this.sign(payload, fieldNames);
    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(payload.signature);
    return expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);
  }

  async checkStatus(params: { transactionUuid: string; totalAmount: number }): Promise<EsewaStatusResult> {
    const url = new URL(this.statusUrl);
    url.searchParams.set("product_code", this.productCode);
    url.searchParams.set("total_amount", params.totalAmount.toFixed(2));
    url.searchParams.set("transaction_uuid", params.transactionUuid);

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`eSewa status check failed with status ${res.status}`);
    }
    const body = (await res.json()) as { status: EsewaApiStatus; ref_id: string | null };
    return { status: body.status, refId: body.ref_id ?? null };
  }
}
