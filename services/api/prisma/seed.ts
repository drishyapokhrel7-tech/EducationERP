import { PrismaClient, PermissionAction } from "@prisma/client";

const prisma = new PrismaClient();

// Full role catalogue from plan §7. Only Super Admin / Organization Admin
// get a permission set wired up in Phase 1 (nothing else exists yet to
// grant permissions over); the rest are seeded as named, permission-less
// roles so later phases attach permissions without an app-tier migration.
const SYSTEM_ROLES = [
  "Super Admin",
  "Organization Admin",
  "Campus Admin",
  "Principal",
  "Vice Principal",
  "Academic Coordinator",
  "Department Head",
  "Teacher",
  "Accountant",
  "HR Manager",
  "Librarian",
  "Transport Manager",
  "Hostel Manager",
  "Receptionist",
  "Exam Coordinator",
  "Student",
  "Parent/Guardian",
];

// Resources that exist so far. Grows with each phase — Phase 1 added the
// first four, Phase 2 slice 2a added the org-hierarchy six.
const RESOURCES = [
  "organization",
  "campus",
  "user",
  "role",
  "faculty",
  "department",
  "program",
  "academic_year",
  "term",
  "section",
];
const ACTIONS = Object.values(PermissionAction);

async function main() {
  // organizationId is null for every system role, and Postgres treats
  // NULL as distinct in a unique index — @@unique([organizationId, name])
  // does not dedupe these rows, so upsert-by-that-key can't be used here.
  // A plain existence check keeps re-running the seed idempotent instead.
  for (const name of SYSTEM_ROLES) {
    const exists = await prisma.role.findFirst({ where: { name, isSystem: true, organizationId: null } });
    if (!exists) {
      await prisma.role.create({ data: { name, isSystem: true } });
    }
  }

  const permissions = [];
  for (const resource of RESOURCES) {
    for (const action of ACTIONS) {
      const permission = await prisma.permission.upsert({
        where: { resource_action: { resource, action } },
        update: {},
        create: { resource, action },
      });
      permissions.push(permission);
    }
  }

  // Still just these two, same as Phase 1: which of Campus Admin/
  // Principal/Academic Coordinator/Department Head should manage which
  // org-hierarchy resource is a real product decision, not something to
  // guess at here — deferred until that's actually specified.
  const fullAccessRoleNames = ["Super Admin", "Organization Admin"];
  for (const roleName of fullAccessRoleNames) {
    const role = await prisma.role.findFirst({ where: { name: roleName, isSystem: true } });
    if (!role) continue;
    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Seeded ${SYSTEM_ROLES.length} roles and ${permissions.length} permissions.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
