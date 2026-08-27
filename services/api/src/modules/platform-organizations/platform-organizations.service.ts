import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { editionStatus } from "../organizations/edition-limits";
import { UpdateOrganizationEditionDto } from "./dto/update-organization-edition.dto";

// PlatformAuthGuard-only (see the controller) — deliberately narrow:
// this is the one capability actually asked for (view every org's
// usage, set its edition), not a general cross-org data-access
// backdoor.
//
// `organizations` itself carries no RLS policy (checked directly —
// only tables exclusively read/written through withTenant have one),
// so listing/updating it needs no tenant context. Student/Employee
// counts are a different story: those tables ARE RLS-protected, so
// counting them without withTenant's session GUC set would silently
// return 0 for every org, not an error — editionStatus is called once
// per org inside its own withTenant(org.id, ...), exactly like
// OrganizationsService.getEditionStatus does for the single-org case.
@Injectable()
export class PlatformOrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listOrganizations() {
    const organizations = await this.prisma.organization.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    });
    // Sequential, not Promise.all over every org — this real
    // environment has accumulated dozens of orgs from e2e test runs
    // (none cleaned up, per this project's standing "don't clean up
    // test/demo data" instruction), and firing that many concurrent
    // withTenant transactions at once exhausted Neon's connection
    // pool (P2028 "unable to start a transaction", confirmed live).
    // An admin console listing schools isn't latency-critical enough
    // to be worth the concurrency here.
    const results = [];
    for (const org of organizations) {
      const status = await this.prisma.withTenant(org.id, (tx) => editionStatus(tx, org.id));
      results.push({ id: org.id, name: org.name, slug: org.slug, ...status });
    }
    return results;
  }

  async updateEdition(organizationId: string, dto: UpdateOrganizationEditionDto) {
    const organization = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) throw new NotFoundException("Organization not found");
    await this.prisma.organization.update({ where: { id: organizationId }, data: { edition: dto.edition } });
    return this.prisma.withTenant(organizationId, (tx) => editionStatus(tx, organizationId));
  }
}
