import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateCampusDto } from "./dto/create-campus.dto";
import { UpdateCampusDto } from "./dto/update-campus.dto";
import { editionStatus } from "./edition-limits";
import { seedCollegeStructure } from "../org-structure/college-structure-defaults";
import { DEFAULT_COLLEGE_STAFF_TYPES, DEFAULT_COLLEGE_DESIGNATIONS } from "../staff/staff.service";
import { assertNoDependents } from "../../common/assert-no-dependents";

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
        // Org-level (StaffType/Designation have no campusId of their
        // own) — skipDuplicates makes this harmless if a second
        // COLLEGE campus is added later, or the org already has one
        // of these codes for some other reason.
        await tx.staffType.createMany({
          data: DEFAULT_COLLEGE_STAFF_TYPES.map((t) => ({ ...t, organizationId })),
          skipDuplicates: true,
        });
        await tx.designation.createMany({
          data: DEFAULT_COLLEGE_DESIGNATIONS.map((d) => ({ ...d, organizationId })),
          skipDuplicates: true,
        });
      }
      return campus;
    });
  }

  async updateCampus(organizationId: string, id: string, dto: UpdateCampusDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadCampus(tx, organizationId, id);
      return tx.campus.update({ where: { id }, data: dto });
    });
  }

  async deleteCampus(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadCampus(tx, organizationId, id);
      await assertNoDependents(
        [
          tx.faculty.count({ where: { campusId: id } }),
          tx.room.count({ where: { campusId: id } }),
          tx.userRole.count({ where: { campusId: id } }),
        ],
        "institution",
      );
      await tx.campus.delete({ where: { id } });
      return { deleted: true };
    });
  }

  private async loadCampus(tx: PrismaClient, organizationId: string, id: string) {
    const campus = await tx.campus.findUnique({ where: { id } });
    if (!campus || campus.organizationId !== organizationId) throw new NotFoundException("Campus not found");
    return campus;
  }

  // Powers the "N of 50 used" badge on Students/Staff and is reused
  // as-is by the platform admin console's org list (see
  // platform-organizations.service.ts) — one counting implementation,
  // not two.
  getEditionStatus(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) => editionStatus(tx, organizationId));
  }
}
