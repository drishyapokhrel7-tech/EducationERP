import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { editionStatus } from "../organizations/edition-limits";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";

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
    // stopped actually working, not just being slow. A small batch
    // size keeps peak concurrent transactions well below whatever
    // triggered the original P2028 while cutting wall-clock time by
    // roughly the batch factor.
    const BATCH_SIZE = 8;
    const results: Array<{ id: string; name: string; slug: string } & Awaited<ReturnType<typeof editionStatus>>> = [];
    for (let i = 0; i < organizations.length; i += BATCH_SIZE) {
      const batch = organizations.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (org) => {
          const status = await this.prisma.withTenant(org.id, (tx) => editionStatus(tx, org.id));
          return { id: org.id, name: org.name, slug: org.slug, ...status };
        }),
      );
      results.push(...batchResults);
    }
    return results;
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
