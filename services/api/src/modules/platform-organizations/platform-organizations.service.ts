import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EditionUpgradeRequestStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { editionStatus } from "../organizations/edition-limits";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// P2028 ("unable to start a transaction in the given time") is this
// project's own well-documented ambient Neon connection-pool
// contention — confirmed live in production for exactly this
// listOrganizations call, even at a conservative batch size (see that
// method's own comment). Retried up to twice with a short, increasing
// backoff before giving up for real — a genuinely stuck DB should
// still surface as an error, not hang forever behind silent retries.
async function withP2028Retry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isP2028 = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2028";
      if (!isP2028 || attempt >= 2) throw err;
      await sleep(200 * (attempt + 1));
    }
  }
}

// PlatformAuthGuard-only (see the controller) — deliberately narrow:
// this is the one capability actually asked for (view every org's
// usage, edit its name/slug/edition, and remove a college and
// everything under it), not a general cross-org data-access backdoor.
//
// `organizations` itself carries no RLS policy (checked directly —
// only tables exclusively read/written through withTenant have one),
// so listing/updating/deleting it needs no tenant context. Student/
// Employee counts are a different story: those tables ARE
// RLS-protected, so counting them without withTenant's session GUC
// set would silently return 0 for every org, not an error —
// editionStatus is called once per org inside its own
// withTenant(org.id, ...), exactly like
// OrganizationsService.getEditionStatus does for the single-org case.
@Injectable()
export class PlatformOrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listOrganizations() {
    const organizations = await this.prisma.organization.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    });
    // Bounded-concurrency batches, not fully sequential and not a
    // single unbounded Promise.all. Fully sequential was the original
    // choice here specifically to dodge a real, confirmed P2028
    // ("unable to start a transaction") from firing every org's
    // withTenant transaction at once — but this environment has since
    // grown past 120 accumulated orgs (e2e runs never clean up
    // test/demo data, per this project's own standing instruction),
    // and one-at-a-time round trips at that volume pushed real-world
    // duration past both this client's request timeout and, in
    // production, Vercel's own function time limit — the endpoint
    // stopped actually working, not just being slow.
    //
    // The real ceiling was Prisma's own default connection_limit
    // (~3 on a serverless function's typical CPU allocation, confirmed
    // live), not this batch number itself — PrismaService now sets an
    // explicit, higher connection_limit (see its own comment) so a
    // batch this size has real headroom instead of contending for 2-3
    // connections. withP2028Retry below stays as the actual safety
    // net regardless — a transient "unable to start a transaction" is
    // retried a couple of times with a short backoff rather than
    // trusting any fixed batch size to never contend, matching this
    // project's own standing posture of expecting and tolerating real
    // Neon latency rather than assuming it away.
    const BATCH_SIZE = 8;
    const results: Array<{ id: string; name: string; slug: string } & Awaited<ReturnType<typeof editionStatus>>> = [];
    for (let i = 0; i < organizations.length; i += BATCH_SIZE) {
      const batch = organizations.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (org) => {
          const status = await withP2028Retry(() =>
            this.prisma.withTenant(org.id, (tx) => editionStatus(tx, org.id)),
          );
          return { id: org.id, name: org.name, slug: org.slug, ...status };
        }),
      );
      results.push(...batchResults);
    }
    return results;
  }

  // Manual-upgrade-request inbox — see BillingService.submitUpgradeRequest's
  // own doc comment for why this exists (eSewa checkout is temporarily
  // disabled on the billing page). edition_upgrade_requests is RLS-protected
  // like every org-scoped table, so a cross-org listing needs the same
  // "loop per-org through withTenant" approach listOrganizations already
  // uses for editionStatus above — batched the same way and for the same
  // reason (confirmed live: a fully sequential loop over this
  // environment's 120+ accumulated orgs left this endpoint stuck loading
  // indefinitely, the exact symptom listOrganizations's own comment
  // already documents).
  async listPendingUpgradeRequests() {
    const organizations = await this.prisma.organization.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, slug: true },
    });
    type UpgradeRequestRow = {
      id: string;
      organizationId: string;
      organizationName: string;
      organizationSlug: string;
      targetEdition: string;
      contactPhone: string;
      notes: string | null;
      requesterEmail: string;
      createdAt: Date;
    };
    const BATCH_SIZE = 8;
    const results: UpgradeRequestRow[] = [];
    for (let i = 0; i < organizations.length; i += BATCH_SIZE) {
      const batch = organizations.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((org) =>
          withP2028Retry(() =>
            this.prisma.withTenant(org.id, (tx) =>
              tx.editionUpgradeRequest.findMany({
                where: { status: EditionUpgradeRequestStatus.PENDING },
                include: { requester: { select: { email: true } } },
                orderBy: { createdAt: "asc" },
              }),
            ),
          ).then((requests) =>
            requests.map(
              (req): UpgradeRequestRow => ({
                id: req.id,
                organizationId: org.id,
                organizationName: org.name,
                organizationSlug: org.slug,
                targetEdition: req.targetEdition,
                contactPhone: req.contactPhone,
                notes: req.notes,
                requesterEmail: req.requester.email,
                createdAt: req.createdAt,
              }),
            ),
          ),
        ),
      );
      results.push(...batchResults.flat());
    }
    return results.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async resolveUpgradeRequest(organizationId: string, id: string) {
    const request = await this.prisma.withTenant(organizationId, (tx) =>
      tx.editionUpgradeRequest.findUnique({ where: { id } }),
    );
    if (!request || request.organizationId !== organizationId) {
      throw new NotFoundException("Upgrade request not found");
    }
    await this.prisma.withTenant(organizationId, (tx) =>
      tx.editionUpgradeRequest.update({
        where: { id },
        data: { status: EditionUpgradeRequestStatus.RESOLVED, resolvedAt: new Date() },
      }),
    );
    return { resolved: true as const, id };
  }

  async updateOrganization(organizationId: string, dto: UpdateOrganizationDto) {
    const organization = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) throw new NotFoundException("Organization not found");

    if (dto.slug && dto.slug !== organization.slug) {
      const existingSlug = await this.prisma.organization.findUnique({ where: { slug: dto.slug } });
      if (existingSlug) throw new ConflictException("Organization slug already in use");
    }

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { name: dto.name, slug: dto.slug, edition: dto.edition },
    });
    const status = await this.prisma.withTenant(organizationId, (tx) => editionStatus(tx, organizationId));
    const updated = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    return { id: updated!.id, name: updated!.name, slug: updated!.slug, ...status };
  }

  // Hard delete, not the dormant Organization.deletedAt soft-delete
  // column — this is the platform admin's own "remove a college and
  // everything created under it" action, explicitly asked for as a
  // real deletion of child records followed by the college master
  // row, not an archive. Every table scoped to an organization (~150
  // FK relations, including the second-hop cases that don't carry
  // their own organizationId — Session/EmailVerificationCode/
  // PasswordResetCode/RolePermission/UserRole, each cascading via
  // whatever org-scoped row they reference) now has `onDelete:
  // Cascade` on its link back to Organization (see
  // prisma/migrations/20260904002611_cascade_delete_organization_children)
  // — Postgres resolves the entire deletion graph as one atomic
  // operation, so a single `organization.delete` here is genuinely
  // "delete every child record, then the college master," not a
  // partial or best-effort wipe.
  async deleteOrganization(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) throw new NotFoundException("Organization not found");
    await this.prisma.organization.delete({ where: { id: organizationId } });
    return { deleted: true, id: organizationId, name: organization.name };
  }
}
