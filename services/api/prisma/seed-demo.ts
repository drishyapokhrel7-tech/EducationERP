/**
 * Demo data for one organization spanning Pre-School through Master's —
 * the "modern institutions run preschool to master's" case. Program and
 * subject-combination *structure* (grade bands, subject lists, credit
 * hours, entrance exams) is real, sourced from two public Nepali
 * institution websites (Samriddhi School for K-12, Prime College for
 * bachelor's/master's). The organization itself is fictional
 * ("Everest Academy & College") — reusing either institution's actual
 * name/branding here would misleadingly imply this demo is affiliated
 * with or endorsed by them, which it isn't. No real people; the admin
 * account is a synthetic demo login only.
 *
 * Idempotent: safe to re-run. Run with `pnpm run demo:seed`.
 */
import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

const ORG_SLUG = "everest-academy-college";
const DEMO_ADMIN_EMAIL = "admin@everest-academy.demo";
const DEMO_ADMIN_PASSWORD = "DemoPass123!";

// Subject catalog. Names/codes follow the source sites exactly, including
// where School and College use different terms for related ideas (e.g.
// "Computer Studies" at school level vs. "Computer Science" as a +2
// Management elective) — kept as distinct subjects rather than merged,
// since that's what the sources actually call them.
const SUBJECTS: Record<string, { name: string; code: string }> = {
  ENG: { name: "English", code: "ENG" },
  NEP: { name: "Nepali", code: "NEP" },
  MATH: { name: "Mathematics", code: "MATH" },
  SCI: { name: "Science", code: "SCI" },
  SOC: { name: "Social Studies", code: "SOC" },
  COMPST: { name: "Computer Studies", code: "COMPST" },
  MOR: { name: "Moral Science", code: "MOR" },
  GK: { name: "General Knowledge", code: "GK" },
  HEALTH: { name: "Health Education", code: "HEALTH" },
  ADVMATH: { name: "Advanced Mathematics", code: "ADVMATH" },
  EPH: { name: "Environment, Health & Population", code: "EPH" },
  SSLS: { name: "Social Studies and Life Skills", code: "SSLS" },
  ACC: { name: "Accounting", code: "ACC" },
  BUSST: { name: "Business Studies", code: "BUSST" },
  ECO: { name: "Economics", code: "ECO" },
  HOTEL: { name: "Hotel Management", code: "HOTEL" },
  CS: { name: "Computer Science", code: "CS" },
  BUSMATH: { name: "Business Mathematics", code: "BUSMATH" },
  MKT: { name: "Marketing", code: "MKT" },
};

const PRIMARY_SUBJECTS = ["ENG", "NEP", "MATH", "SCI", "SOC", "COMPST", "MOR", "GK", "HEALTH"];
const SECONDARY_SUBJECTS = ["ENG", "NEP", "MATH", "SCI", "SOC", "COMPST", "MOR", "GK", "ADVMATH", "EPH"];

// Plus-2 Management's five real subject-combination options.
const PLUS_TWO_OPTIONS: { code: string; name: string; subjects: string[] }[] = [
  { code: "OPT1", name: "Option 1", subjects: ["NEP", "ENG", "SSLS", "ACC", "BUSST", "ECO"] },
  { code: "OPT2", name: "Option 2", subjects: ["NEP", "ENG", "SSLS", "ACC", "BUSST", "HOTEL"] },
  { code: "OPT3", name: "Option 3", subjects: ["NEP", "ENG", "SSLS", "ACC", "BUSMATH", "CS"] },
  { code: "OPT4", name: "Option 4", subjects: ["NEP", "ENG", "SSLS", "ACC", "CS", "ECO"] },
  { code: "OPT5", name: "Option 5", subjects: ["NEP", "ENG", "SSLS", "ACC", "CS", "MKT"] },
];

const SCHOOL_PROGRAMS = [
  { code: "PLAYGROUP", name: "Play Group", level: "Pre-School" },
  { code: "NURSERY", name: "Nursery", level: "Pre-School" },
  { code: "JKG", name: "Junior Kindergarten", level: "Pre-School" },
  { code: "SKG", name: "Senior Kindergarten", level: "Pre-School" },
  { code: "PRIMARY", name: "Primary School (Grade 1-5)", level: "Primary" },
  { code: "SECONDARY", name: "Secondary School (Grade 6-10)", level: "Secondary" },
  { code: "PLUS2MGMT", name: "Plus-2 Management (Grade 11-12)", level: "Higher Secondary" },
];

const COLLEGE_PROGRAMS = [
  {
    code: "BSCCSIT",
    name: "Bachelor of Science in Computer Science and Information Technology",
    level: "Bachelor",
    durationSemesters: 8,
    creditHours: 126,
    entranceExam: "IOST",
  },
  {
    code: "BCA",
    name: "Bachelor of Computer Applications",
    level: "Bachelor",
    durationSemesters: 8,
    creditHours: 126,
    entranceExam: "BCA",
  },
  {
    code: "BBA",
    name: "Bachelor of Business Administration",
    level: "Bachelor",
    durationSemesters: 8,
    creditHours: 120,
    entranceExam: "CMAT",
  },
  {
    code: "BITM",
    name: "Bachelor of Information Technology Management",
    level: "Bachelor",
    durationSemesters: 8,
    creditHours: 126,
    entranceExam: "CMAT",
  },
  {
    code: "BBM",
    name: "Bachelor of Business Management",
    level: "Bachelor",
    durationSemesters: 8,
    creditHours: 120,
    entranceExam: "CMAT",
  },
  {
    code: "BBS",
    name: "Bachelor of Business Studies",
    level: "Bachelor",
    durationSemesters: 8,
    creditHours: null,
    entranceExam: "None",
  },
  {
    code: "MBS",
    name: "Master of Business Studies",
    level: "Master",
    durationSemesters: 4,
    creditHours: 60,
    entranceExam: "CMAT (MBS)",
  },
];

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    update: {},
    create: { name: "Everest Academy & College", slug: ORG_SLUG },
  });

  const adminRole = await prisma.role.findFirst({
    where: { isSystem: true, name: "Organization Admin" },
  });
  if (!adminRole) {
    throw new Error("System roles are not seeded — run prisma:seed first");
  }

  const existingAdmin = await prisma.user.findUnique({ where: { email: DEMO_ADMIN_EMAIL } });
  if (!existingAdmin) {
    const passwordHash = await argon2.hash(DEMO_ADMIN_PASSWORD);
    await prisma.user.create({
      data: {
        organizationId: organization.id,
        email: DEMO_ADMIN_EMAIL,
        passwordHash,
        firstName: "Demo",
        lastName: "Admin",
        status: "ACTIVE",
        userRoles: { create: { roleId: adminRole.id } },
      },
    });
  }

  const campus = await upsertByCode("campus", { organizationId: organization.id, name: "Kathmandu Main Campus", code: "MAIN" });

  const schoolFaculty = await upsertFaculty(organization.id, campus.id, "School", "SCHOOL");
  const collegeFaculty = await upsertFaculty(organization.id, campus.id, "College", "COLLEGE");

  const schoolDept = await upsertDepartment(organization.id, schoolFaculty.id, "School Programs", "SCHOOLPROG");
  const collegeDept = await upsertDepartment(organization.id, collegeFaculty.id, "College Programs", "COLLEGEPROG");

  const subjectIds: Record<string, string> = {};
  for (const key of Object.keys(SUBJECTS)) {
    const s = SUBJECTS[key];
    const subject = await upsertSubject(organization.id, s.name, s.code);
    subjectIds[key] = subject.id;
  }

  const schoolProgramIds: Record<string, string> = {};
  for (const p of SCHOOL_PROGRAMS) {
    const program = await upsertProgram(organization.id, schoolDept.id, p.name, p.code, { level: p.level });
    schoolProgramIds[p.code] = program.id;
  }

  for (const p of COLLEGE_PROGRAMS) {
    await upsertProgram(organization.id, collegeDept.id, p.name, p.code, {
      level: p.level,
      durationSemesters: p.durationSemesters,
      creditHours: p.creditHours ?? undefined,
      entranceExam: p.entranceExam,
    });
  }

  await upsertCurriculumWithSubjects(
    organization.id,
    schoolProgramIds.PRIMARY,
    "Primary Curriculum",
    "PRIM-CURR",
    PRIMARY_SUBJECTS.map((k) => subjectIds[k]),
  );

  await upsertCurriculumWithSubjects(
    organization.id,
    schoolProgramIds.SECONDARY,
    "Secondary Curriculum",
    "SEC-CURR",
    SECONDARY_SUBJECTS.map((k) => subjectIds[k]),
  );

  for (const option of PLUS_TWO_OPTIONS) {
    await upsertCurriculumWithSubjects(
      organization.id,
      schoolProgramIds.PLUS2MGMT,
      option.name,
      option.code,
      option.subjects.map((k) => subjectIds[k]),
    );
  }

  // eslint-disable-next-line no-console
  console.log(`Demo org ready: ${organization.name} (slug: ${organization.slug})`);
  // eslint-disable-next-line no-console
  console.log(`Login: ${DEMO_ADMIN_EMAIL} / ${DEMO_ADMIN_PASSWORD}`);
}

async function upsertByCode(
  _table: "campus",
  data: { organizationId: string; name: string; code: string },
) {
  const existing = await prisma.campus.findFirst({
    where: { organizationId: data.organizationId, code: data.code },
  });
  if (existing) return existing;
  return prisma.campus.create({ data });
}

async function upsertFaculty(organizationId: string, campusId: string, name: string, code: string) {
  const existing = await prisma.faculty.findFirst({ where: { campusId, code } });
  if (existing) return existing;
  return prisma.faculty.create({ data: { organizationId, campusId, name, code } });
}

async function upsertDepartment(organizationId: string, facultyId: string, name: string, code: string) {
  const existing = await prisma.department.findFirst({ where: { facultyId, code } });
  if (existing) return existing;
  return prisma.department.create({ data: { organizationId, facultyId, name, code } });
}

async function upsertSubject(organizationId: string, name: string, code: string) {
  const existing = await prisma.subject.findFirst({ where: { organizationId, code } });
  if (existing) return existing;
  return prisma.subject.create({ data: { organizationId, name, code } });
}

async function upsertProgram(
  organizationId: string,
  departmentId: string,
  name: string,
  code: string,
  extra: { level?: string; durationSemesters?: number; creditHours?: number; entranceExam?: string },
) {
  const existing = await prisma.program.findFirst({ where: { departmentId, code } });
  if (existing) return existing;
  return prisma.program.create({ data: { organizationId, departmentId, name, code, ...extra } });
}

async function upsertCurriculumWithSubjects(
  organizationId: string,
  programId: string,
  name: string,
  code: string,
  subjectIds: string[],
) {
  let curriculum = await prisma.curriculum.findFirst({ where: { programId, code } });
  if (!curriculum) {
    curriculum = await prisma.curriculum.create({ data: { organizationId, programId, name, code } });
  }
  for (const subjectId of subjectIds) {
    const existing = await prisma.curriculumSubject.findFirst({
      where: { curriculumId: curriculum.id, subjectId },
    });
    if (!existing) {
      await prisma.curriculumSubject.create({
        data: { organizationId, curriculumId: curriculum.id, subjectId, isCompulsory: true },
      });
    }
  }
  return curriculum;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
