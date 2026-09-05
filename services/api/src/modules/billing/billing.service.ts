import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Edition, EsewaTransactionStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EsewaGatewayService, EsewaRedirectPayload } from "../finance/esewa-gateway.service";
import { DeliveryProvider } from "../communication/delivery-provider";
import { EDITION_PRICING_NPR, effectiveEdition, meetsEdition } from "../organizations/edition-limits";
import { InitiateUpgradeDto } from "./dto/initiate-upgrade.dto";
import { SubmitUpgradeRequestDto } from "./dto/submit-upgrade-request.dto";

const UPGRADE_NOTIFICATION_EMAIL = "ovexatechnology@gmail.com";

function toNumber(value: Prisma.Decimal | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

function addOneMonth(date: Date): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
}

/**
 * The platform's own revenue — an org paying Ovexa itself to unlock a
 * higher edition — not a tenant-internal fee collected from a
 * student, so this is a genuinely separate flow from
 * FinanceService's eSewa integration, not an extension of it. Reuses
 * EsewaGatewayService directly (a stateless, generic "talk to eSewa"
 * wrapper with zero invoice-specific logic) rather than duplicating
 * HMAC signing/status-check logic.
 *
 * "Monthly" pricing is honestly a manual pay-per-month purchase, not
 * real recurring auto-billing — eSewa's ePay v2 has no recurring-
 * charge API. A successful payment extends editionExpiresAt by one
 * month from whichever is later: now, or the org's current expiry (a
 * renewal before lapse stacks the extra month rather than wasting the
 * remainder already paid for).
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly esewaGateway: EsewaGatewayService,
    private readonly delivery: DeliveryProvider,
  ) {}

  async initiateUpgrade(organizationId: string, userId: string, dto: InitiateUpgradeDto) {
    const organization = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) throw new NotFoundException("Organization not found");

    const target = dto.targetEdition as Edition;
    if (meetsEdition(effectiveEdition(organization), target)) {
      throw new BadRequestException("Your organization already has this edition or higher");
    }

    const amount = EDITION_PRICING_NPR[target];
    if (amount === null) {
      // Unreachable given InitiateUpgradeDto's own allow-list (FREE is
      // never a valid target), kept as a real guard rather than an
      // assertion — a future edition added to the enum without a
      // price must fail loudly here, not silently charge nothing.
      throw new BadRequestException("This edition has no purchasable price");
    }

    const transactionUuid = randomUUID();
    await this.prisma.withTenant(organizationId, (tx) =>
      tx.editionUpgradePayment.create({
        data: { organizationId, targetEdition: target, amount, transactionUuid, initiatedBy: userId },
      }),
    );

    const webOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3020";
    const callbackUrl = `${webOrigin}/dashboard/billing/callback`;

    return this.esewaGateway.buildPaymentForm({
      amount,
      transactionUuid,
      successUrl: callbackUrl,
      failureUrl: callbackUrl,
    });
  }

  async confirmUpgrade(organizationId: string, encodedData: string) {
    const result = await this.prisma.withTenant(organizationId, async (tx) => {
      let payload: EsewaRedirectPayload;
      try {
        payload = JSON.parse(Buffer.from(encodedData, "base64").toString("utf-8")) as EsewaRedirectPayload;
      } catch {
        throw new BadRequestException("Malformed payment confirmation payload");
      }
      if (!payload.transaction_uuid) {
        throw new BadRequestException("Malformed payment confirmation payload");
      }

      if (!this.esewaGateway.verifySignature(payload)) {
        // Not a hard rejection — see EsewaGatewayService's class doc.
        // The real gate below is a live checkStatus() call.
        this.logger.warn(`eSewa redirect signature did not verify for transaction ${payload.transaction_uuid}`);
      }

      const upgradeTx = await tx.editionUpgradePayment.findUnique({
        where: { transactionUuid: payload.transaction_uuid },
      });
      if (!upgradeTx || upgradeTx.organizationId !== organizationId) {
        throw new NotFoundException("Payment transaction not found");
      }

      if (upgradeTx.status === EsewaTransactionStatus.COMPLETE) {
        // Idempotent replay — a reloaded callback page or a double-
        // submitted click must never extend the expiry twice.
        const organization = await tx.organization.findUnique({ where: { id: organizationId } });
        return {
          failed: false as const,
          edition: organization!.edition,
          editionExpiresAt: organization!.editionExpiresAt,
        };
      }

      const result = await this.esewaGateway.checkStatus({
        transactionUuid: upgradeTx.transactionUuid,
        totalAmount: toNumber(upgradeTx.amount),
      });

      if (result.status !== "COMPLETE") {
        // Deliberately NOT thrown here — a thrown error inside a
        // Prisma interactive transaction rolls the whole transaction
        // back, which would silently undo this very update and leave
        // the row stuck at INITIATED forever (confirmed for real: a
        // live sandbox NOT_FOUND check against this exact code path
        // before this fix left the row unchanged despite the update
        // call running). Returning a tagged failure and throwing
        // *after* the transaction commits is what actually persists
        // the FAILED/CANCELED status.
        await tx.editionUpgradePayment.update({
          where: { id: upgradeTx.id },
          data: {
            status: result.status === "CANCELED" ? EsewaTransactionStatus.CANCELED : EsewaTransactionStatus.FAILED,
            completedAt: new Date(),
          },
        });
        return { failed: true as const, esewaStatus: result.status };
      }

      const organization = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!organization) throw new NotFoundException("Organization not found");

      const currentExpiry = organization.editionExpiresAt;
      const extendFrom = currentExpiry && currentExpiry > new Date() ? currentExpiry : new Date();
      const editionExpiresAt = addOneMonth(extendFrom);

      const updated = await tx.organization.update({
        where: { id: organizationId },
        data: { edition: upgradeTx.targetEdition, editionExpiresAt },
      });
      await tx.editionUpgradePayment.update({
        where: { id: upgradeTx.id },
        data: { status: EsewaTransactionStatus.COMPLETE, esewaRefId: result.refId, completedAt: new Date() },
      });

      return { failed: false as const, edition: updated.edition, editionExpiresAt: updated.editionExpiresAt };
    });

    if (result.failed) {
      throw new BadRequestException(`Payment was not completed (eSewa status: ${result.esewaStatus})`);
    }
    return { status: "COMPLETE" as const, edition: result.edition, editionExpiresAt: result.editionExpiresAt };
  }

  /**
   * The manual fallback while eSewa checkout is disabled on the
   * billing page (real sandbox test-credential friction was confusing
   * org admins — see BillingController's own note). No payment
   * happens here at all: this just records what the org wants and
   * notifies Ovexa staff, who then upgrade the org manually via
   * PlatformOrganizationsService.updateOrganization (unchanged) and
   * mark this request resolved from the Platform Admin console.
   */
  async submitUpgradeRequest(organizationId: string, userId: string, dto: SubmitUpgradeRequestDto) {
    const organization = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) throw new NotFoundException("Organization not found");

    const target = dto.targetEdition as Edition;
    if (meetsEdition(effectiveEdition(organization), target)) {
      throw new BadRequestException("Your organization already has this edition or higher");
    }

    const requester = await this.prisma.user.findUnique({ where: { id: userId } });

    const created = await this.prisma.withTenant(organizationId, (tx) =>
      tx.editionUpgradeRequest.create({
        data: {
          organizationId,
          targetEdition: target,
          contactPhone: dto.contactPhone,
          notes: dto.notes,
          requestedBy: userId,
        },
      }),
    );

    // DeliveryProvider.sendEmail never throws (always resolves
    // SENT/FAILED) — no try/catch needed, same as the health-watchdog
    // module's own "notify the platform operator" email.
    await this.delivery.sendEmail(
      UPGRADE_NOTIFICATION_EMAIL,
      `Edition upgrade request — ${organization.name}`,
      [
        `${organization.name} (${organization.slug}) requested to upgrade to ${target}.`,
        `Contact phone: ${dto.contactPhone}`,
        `Account email: ${requester?.email ?? "unknown"}`,
        dto.notes ? `Notes: ${dto.notes}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );

    return { id: created.id, status: created.status };
  }
}
