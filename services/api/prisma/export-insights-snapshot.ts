/**
 * Dumps a point-in-time JSON snapshot of platform-wide registration
 * and module-adoption data for the Platform Insights desktop app
 * (apps/platform-insights-client) to read — a manual, owner-run step,
 * not a live API. Run with `pnpm run insights:export` (optionally
 * `-- --out <path>`, default `./insights-snapshot-<ISO-date>.json`).
 *
 * Uses a raw PrismaClient, same as seed-platform-admin.ts — this
 * bypasses RLS entirely (it connects as the DB owner, not the
 * app_runtime role PrismaService/withTenant use), so every count below
 * is a plain `where: { organizationId }` filter, no tenant-context
 * dance needed.
 */
import { PrismaClient, Edition } from "@prisma/client";
import { writeFileSync } from "fs";

const prisma = new PrismaClient();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Same P2028 ("unable to start a transaction") retry shape as
// platform-organizations.service.ts's withP2028Retry — this script
// runs against the same ambient-latency Neon instance.
async function withP2028Retry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isP2028 =
        err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2028";
      if (!isP2028 || attempt >= 2) throw err;
      await sleep(200 * (attempt + 1));
    }
  }
}

// One representative table per major module — a real usage-adoption
// proxy ("has this org ever touched this module at all"), not an
// exhaustive accounting of every table.
const MODULE_COUNTERS = {
  admissions: (organizationId: string) => prisma.admissionApplication.count({ where: { organizationId } }),
  timetable: (organizationId: string) => prisma.classSchedule.count({ where: { organizationId } }),
  attendance: (organizationId: string) => prisma.attendanceSession.count({ where: { organizationId } }),
  syllabus: (organizationId: string) => prisma.syllabus.count({ where: { organizationId } }),
  assignments: (organizationId: string) => prisma.assignment.count({ where: { organizationId } }),
  knowledgeChecks: (organizationId: string) => prisma.knowledgeCheck.count({ where: { organizationId } }),
  exams: (organizationId: string) => prisma.exam.count({ where: { organizationId } }),
  finance: (organizationId: string) => prisma.invoice.count({ where: { organizationId } }),
  leave: (organizationId: string) => prisma.leaveRequest.count({ where: { organizationId } }),
  payroll: (organizationId: string) => prisma.payroll.count({ where: { organizationId } }),
  transport: (organizationId: string) => prisma.vehicle.count({ where: { organizationId } }),
  hostel: (organizationId: string) => prisma.hostelAllocation.count({ where: { organizationId } }),
  inventory: (organizationId: string) => prisma.inventoryItem.count({ where: { organizationId } }),
  communication: (organizationId: string) => prisma.message.count({ where: { organizationId } }),
  certificates: (organizationId: string) => prisma.certificate.count({ where: { organizationId } }),
  alumni: (organizationId: string) => prisma.alumniProfile.count({ where: { organizationId } }),
} as const;

type ModuleKey = keyof typeof MODULE_COUNTERS;

interface OrgSnapshot {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  edition: Edition;
  editionExpiresAt: string | null;
  studentCount: number;
  employeeCount: number;
  moduleUsage: Record<ModuleKey, number>;
}

function parseOutPath(): string {
  const flagIndex = process.argv.indexOf("--out");
  if (flagIndex !== -1 && process.argv[flagIndex + 1]) return process.argv[flagIndex + 1];
  return `./insights-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
}

async function buildOrgSnapshot(org: {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  edition: Edition;
  editionExpiresAt: Date | null;
}): Promise<OrgSnapshot> {
  const [studentCount, employeeCount, ...moduleCounts] = await withP2028Retry(() =>
    Promise.all([
      prisma.student.count({ where: { organizationId: org.id, deletedAt: null } }),
      prisma.employee.count({ where: { organizationId: org.id, deletedAt: null } }),
      ...Object.values(MODULE_COUNTERS).map((count) => count(org.id)),
    ]),
  );
  const moduleUsage = Object.fromEntries(
    Object.keys(MODULE_COUNTERS).map((key, i) => [key, moduleCounts[i]]),
  ) as Record<ModuleKey, number>;

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    createdAt: org.createdAt.toISOString(),
    edition: org.edition,
    editionExpiresAt: org.editionExpiresAt?.toISOString() ?? null,
    studentCount,
    employeeCount,
    moduleUsage,
  };
}

async function main() {
  const organizations = await prisma.organization.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true, createdAt: true, edition: true, editionExpiresAt: true },
    orderBy: { createdAt: "asc" },
  });

  // Bounded-concurrency batches, same reasoning as
  // platform-organizations.service.ts's listOrganizations — this
  // environment has 130+ accumulated orgs, and one unbounded
  // Promise.all across all of them would contend hard for connections.
  const BATCH_SIZE = 8;
  const results: OrgSnapshot[] = [];
  for (let i = 0; i < organizations.length; i += BATCH_SIZE) {
    const batch = organizations.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(buildOrgSnapshot));
    results.push(...batchResults);
    // eslint-disable-next-line no-console
    console.log(`  ...${Math.min(i + BATCH_SIZE, organizations.length)} / ${organizations.length} organizations`);
  }

  const snapshot = { generatedAt: new Date().toISOString(), organizations: results };
  const outPath = parseOutPath();
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  // eslint-disable-next-line no-console
  console.log(`Wrote snapshot for ${results.length} organizations to ${outPath}`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
