import { Edition, PrismaClient } from "@prisma/client";
import { NotFoundException } from "@nestjs/common";
import { EditionLimitExceededException } from "../../common/edition-limit-exceeded.exception";

// The two concrete numbers actually given, plus Ultra as the
// "no restrictions" top tier — a plain constant map, not a
// per-org-configurable DB setting; nothing this session has been
// asked to make admin-configurable yet. `null` means unlimited.
export const EDITION_LIMITS: Record<Edition, number | null> = {
  FREE: 50,
  PROFESSIONAL: 500,
  ULTRA: null,
};

export function editionLimit(edition: Edition): number | null {
  return EDITION_LIMITS[edition];
}

// The combined-count enforcement point — called by both
// StudentsService.createStudent and StaffService.createEmployee
// (the two places that add to what this session's clarified scope
// calls "student, staff records"), so the rule lives in exactly one
// place rather than being re-implemented per caller. "Block only new
// records" (confirmed via AskUserQuestion) means this is a pre-create
// gate, not something that touches reads/updates/other domains at
// all — an org already over its (possibly newly-lowered) cap simply
// can't add more, with zero special-case logic for how it got there.
export async function assertUnderEditionLimit(tx: PrismaClient, organizationId: string) {
  const organization = await tx.organization.findUnique({ where: { id: organizationId } });
  if (!organization) throw new NotFoundException("Organization not found");

  const limit = editionLimit(organization.edition);
  if (limit === null) return;

  const [studentCount, employeeCount] = await Promise.all([
    tx.student.count({ where: { organizationId, deletedAt: null } }),
    tx.employee.count({ where: { organizationId, deletedAt: null } }),
  ]);
  if (studentCount + employeeCount >= limit) {
    throw new EditionLimitExceededException(organization.edition, limit);
  }
}

export async function editionStatus(tx: PrismaClient, organizationId: string) {
  const organization = await tx.organization.findUnique({ where: { id: organizationId } });
  if (!organization) throw new NotFoundException("Organization not found");

  const [studentCount, employeeCount] = await Promise.all([
    tx.student.count({ where: { organizationId, deletedAt: null } }),
    tx.employee.count({ where: { organizationId, deletedAt: null } }),
  ]);
  const limit = editionLimit(organization.edition);
  const combined = studentCount + employeeCount;
  return {
    edition: organization.edition,
    studentCount,
    employeeCount,
    limit,
    atLimit: limit !== null && combined >= limit,
  };
}
