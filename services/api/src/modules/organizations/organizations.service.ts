import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateCampusDto } from "./dto/create-campus.dto";
import { editionStatus } from "./edition-limits";
import { seedCollegeStructure } from "../org-structure/college-structure-defaults";

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

  // A COLLEGE-type campus gets a real default Faculty/Department/
  // Program structure seeded immediately — see
  // college-structure-defaults.ts for what and why. Every other type
  // behaves exactly as before (a bare campus row, nothing else).
  createCampus(organizationId: string, dto: CreateCampusDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const campus = await tx.campus.create({
        data: { organizationId, name: dto.name, code: dto.code, type: dto.type ?? "GENERIC" },
      });
      if (campus.type === "COLLEGE") {
        await seedCollegeStructure(tx, organizationId, campus.id);
      }
      return campus;
    });
  }

  // Powers the "N of 50 used" badge on Students/Staff and is reused
  // as-is by the platform admin console's org list (see
  // platform-organizations.service.ts) — one counting implementation,
  // not two.
  getEditionStatus(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) => editionStatus(tx, organizationId));
  }
}
