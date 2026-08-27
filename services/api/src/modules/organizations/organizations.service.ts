import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateCampusDto } from "./dto/create-campus.dto";
import { editionStatus } from "./edition-limits";

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwnOrganization(organizationId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) {
      throw new NotFoundException("Organization not found");
    }
    return org;
  }

  // organizationId is taken from the caller's JWT (see
  // OrganizationsController), never from a route param or body field.
  // withTenant sets the RLS session GUC so the database enforces the
  // same scope independently of this WHERE clause — two layers, not one.
  listCampuses(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.campus.findMany({ where: { organizationId, deletedAt: null } }),
    );
  }

  createCampus(organizationId: string, dto: CreateCampusDto) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.campus.create({ data: { organizationId, name: dto.name, code: dto.code } }),
    );
  }

  // Powers the "N of 50 used" badge on Students/Staff and is reused
  // as-is by the platform admin console's org list (see
  // platform-organizations.service.ts) — one counting implementation,
  // not two.
  getEditionStatus(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) => editionStatus(tx, organizationId));
  }
}
