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
  // Humanities/Arts and Education, sourced from Tribhuvan University's
  // own faculty sites (fohss.tu.edu.np, foe.tu.edu.np) — same "real
  // structural facts, fictional org identity" precedent as every other
  // program above. BA is TU's real current 4-year (8-semester)
  // syllabus (in effect since AY 2076/077, 2,000 marks total across
  // compulsory English/Nepali/Nepal Studies plus two major and two
  // elective subjects — not credit-hour based, same "creditHours: null"
  // precedent as BBS above for a marks-based program). Faculty of
  // Education runs Bachelor's on the identical 8-semester structure
  // (confirmed via its own semester-numbered exam notices); Master's
  // level at both faculties has moved to a semester system too (MA
  // Economics/Sociology results and MSSEd results both published by
  // semester on their respective sites), so MA/M.Ed. follow the same
  // 4-semester shape as this org's existing MBS. Neither BA nor
  // Education entry has an entrance exam per TU's own eligibility
  // page (grade-based admission only), matching BBS's existing "None"
  // precedent rather than BBA/BCA's entrance-exam-gated ones.
  {
    code: "BA",
    name: "Bachelor of Arts",
    level: "Bachelor",
    durationSemesters: 8,
    creditHours: null,
    entranceExam: "None",
  },
  {
    code: "MA",
    name: "Master of Arts",
    level: "Master",
    durationSemesters: 4,
    creditHours: null,
    entranceExam: "None",
  },
  {
    code: "BED",
    name: "Bachelor of Education",
    level: "Bachelor",
    durationSemesters: 8,
    creditHours: null,
    entranceExam: "None",
  },
  {
    code: "MED",
    name: "Master of Education",
    level: "Master",
    durationSemesters: 4,
    creditHours: null,
    entranceExam: "None",
  },
];

// A handful of synthetic students (fictional names, not real people)
// enrolled across a school program and a college program, so the demo
// shows the full Student → Guardian → Enrollment chain working, not
// just an empty list.
// photoUrl values are real files already uploaded through this org's
// own live Google Drive storage backend (simple initials-on-a-
// colored-circle avatars, generated locally — not real photos of real
// people, matching the "invent identity" precedent already applied to
// the org name itself). Hardcoded here rather than generated at seed
// time because this script is pure Prisma writes with no HTTP
// dependency on the API server being up — adding an upload call here
// would introduce that coupling for a five-avatar demo convenience.
const STUDENTS: {
  code: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  programCode: string;
  sectionCode: string;
  guardian: { firstName: string; lastName: string; phone: string; relationship: string };
  photoUrl: string;
}[] = [
  {
    code: "STU-0001",
    firstName: "Aarav",
    lastName: "Sharma",
    dateOfBirth: "2018-03-15",
    gender: "Male",
    programCode: "PRIMARY",
    sectionCode: "G3",
    guardian: { firstName: "Bishnu", lastName: "Sharma", phone: "9801234561", relationship: "Father" },
    photoUrl: "https://drive.google.com/uc?id=1u6XSNYoeAcr5fjoRHaXQ8YH8GLJIyLex&export=download",
  },
  {
    code: "STU-0002",
    firstName: "Sita",
    lastName: "Gurung",
    dateOfBirth: "2013-07-22",
    gender: "Female",
    programCode: "SECONDARY",
    sectionCode: "G8",
    guardian: { firstName: "Kamala", lastName: "Gurung", phone: "9801234562", relationship: "Mother" },
    photoUrl: "https://drive.google.com/uc?id=1A_2ZxNRFA9cGl0S3kRROnd5LbN2WFJLY&export=download",
  },
  {
    code: "STU-0003",
    firstName: "Rohan",
    lastName: "Thapa",
    dateOfBirth: "2007-11-05",
    gender: "Male",
    programCode: "BSCCSIT",
    sectionCode: "SEM1",
    guardian: { firstName: "Suresh", lastName: "Thapa", phone: "9801234563", relationship: "Father" },
    photoUrl: "https://drive.google.com/uc?id=1pU0-0zX2cyNr9TuwwrJhWnUM2x_nAy3r&export=download",
  },
];

// Admission applications spanning the review pipeline (fictional
// applicants, not real people) — one at each stage, plus one carried all
// the way through to enrollment, to show the Admissions → Student bridge
// actually working rather than just listing empty statuses.
const APPLICATIONS: {
  code: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  programCode: string;
  guardianName?: string;
  guardianPhone?: string;
  score?: number;
  finalStatus: "SUBMITTED" | "UNDER_REVIEW" | "ENROLLED";
  enrollAs?: { studentCode: string; sectionCode: string };
}[] = [
  {
    code: "APP-0001",
    firstName: "Nirmala",
    lastName: "Adhikari",
    dateOfBirth: "2019-02-10",
    programCode: "PLAYGROUP",
    guardianName: "Ramesh Adhikari",
    guardianPhone: "9801234571",
    finalStatus: "SUBMITTED",
  },
  {
    code: "APP-0002",
    firstName: "Prakash",
    lastName: "KC",
    dateOfBirth: "2014-06-18",
    programCode: "SECONDARY",
    guardianName: "Dipak KC",
    guardianPhone: "9801234572",
    finalStatus: "UNDER_REVIEW",
  },
  {
    code: "APP-0003",
    firstName: "Anita",
    lastName: "Poudel",
    dateOfBirth: "2007-09-02",
    programCode: "BSCCSIT",
    guardianName: "Krishna Poudel",
    guardianPhone: "9801234573",
    score: 88,
    finalStatus: "ENROLLED",
    enrollAs: { studentCode: "STU-0004", sectionCode: "SEM1" },
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

  const collegeProgramIds: Record<string, string> = {};
  for (const p of COLLEGE_PROGRAMS) {
    const program = await prisma.program.findFirst({ where: { departmentId: collegeDept.id, code: p.code } });
    if (program) collegeProgramIds[p.code] = program.id;
  }
  const allProgramIds = { ...schoolProgramIds, ...collegeProgramIds };

  const academicYear = await upsertAcademicYear(organization.id, "2026-2027", "2026-08-01", "2027-06-30");
  const term = await upsertTerm(organization.id, academicYear.id, "Term 1", "T1", 1, "2026-08-01", "2026-12-15");

  const sectionIds: Record<string, string> = {};
  for (const s of [
    { programCode: "PRIMARY", name: "Grade 3", code: "G3", capacity: 30 },
    { programCode: "SECONDARY", name: "Grade 8", code: "G8", capacity: 30 },
    { programCode: "BSCCSIT", name: "Semester 1", code: "SEM1", capacity: 40 },
  ]) {
    const section = await upsertSection(
      organization.id,
      allProgramIds[s.programCode],
      term.id,
      s.name,
      s.code,
      s.capacity,
    );
    sectionIds[s.code] = section.id;
  }

  for (const s of STUDENTS) {
    const student = await upsertStudent(organization.id, s.code, s.firstName, s.lastName, s.dateOfBirth, s.gender);
    const guardian = await upsertGuardian(
      organization.id,
      s.guardian.firstName,
      s.guardian.lastName,
      s.guardian.phone,
    );
    await upsertStudentGuardian(organization.id, student.id, guardian.id, s.guardian.relationship, true);
    await upsertEnrollment(
      organization.id,
      student.id,
      allProgramIds[s.programCode],
      sectionIds[s.sectionCode],
      term.id,
      "2026-08-01",
    );
  }

  for (const a of APPLICATIONS) {
    const application = await upsertAdmissionApplication(organization.id, a.code, {
      programId: allProgramIds[a.programCode],
      firstName: a.firstName,
      lastName: a.lastName,
      dateOfBirth: a.dateOfBirth,
      guardianName: a.guardianName,
      guardianPhone: a.guardianPhone,
      score: a.score,
    });

    if (a.finalStatus === "UNDER_REVIEW" && application.status === "SUBMITTED") {
      await setApplicationStatus(organization.id, application.id, "UNDER_REVIEW");
    }

    if (a.finalStatus === "ENROLLED" && application.status !== "ENROLLED" && a.enrollAs) {
      if (application.status === "SUBMITTED") {
        await setApplicationStatus(organization.id, application.id, "UNDER_REVIEW");
        await setApplicationStatus(organization.id, application.id, "APPROVED");
      }
      await enrollApplication(
        organization.id,
        application.id,
        a.enrollAs.studentCode,
        allProgramIds[a.programCode],
        sectionIds[a.enrollAs.sectionCode],
        term.id,
        "2026-08-15",
      );
    }
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

async function upsertAcademicYear(organizationId: string, name: string, startDate: string, endDate: string) {
  const existing = await prisma.academicYear.findFirst({ where: { organizationId, name } });
  if (existing) return existing;
  return prisma.academicYear.create({
    data: { organizationId, name, startDate: new Date(startDate), endDate: new Date(endDate), isCurrent: true },
  });
}

async function upsertTerm(
  organizationId: string,
  academicYearId: string,
  name: string,
  code: string,
  sequence: number,
  startDate: string,
  endDate: string,
) {
  const existing = await prisma.term.findFirst({ where: { academicYearId, code } });
  if (existing) return existing;
  return prisma.term.create({
    data: {
      organizationId,
      academicYearId,
      name,
      code,
      sequence,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    },
  });
}

async function upsertSection(
  organizationId: string,
  programId: string,
  termId: string,
  name: string,
  code: string,
  capacity: number,
) {
  const existing = await prisma.section.findFirst({ where: { termId, programId, code } });
  if (existing) return existing;
  return prisma.section.create({ data: { organizationId, programId, termId, name, code, capacity } });
}

async function upsertStudent(
  organizationId: string,
  studentCode: string,
  firstName: string,
  lastName: string,
  dateOfBirth: string,
  gender?: string,
  photoUrl?: string,
) {
  const existing = await prisma.student.findFirst({ where: { organizationId, studentCode } });
  if (existing) {
    // Backfill-only patch (never overwrites a photo an admin may have
    // since set through the real UI) — added when the photoUrl field
    // itself was added, so a re-run against an already-seeded org
    // picks up the demo avatar without disturbing anything else.
    if (photoUrl && !existing.photoUrl) {
      return prisma.student.update({ where: { id: existing.id }, data: { photoUrl } });
    }
    return existing;
  }
  return prisma.student.create({
    data: { organizationId, studentCode, firstName, lastName, dateOfBirth: new Date(dateOfBirth), gender, photoUrl },
  });
}

async function upsertGuardian(organizationId: string, firstName: string, lastName: string, phone: string) {
  const existing = await prisma.guardian.findFirst({ where: { organizationId, phone } });
  if (existing) return existing;
  return prisma.guardian.create({ data: { organizationId, firstName, lastName, phone } });
}

async function upsertStudentGuardian(
  organizationId: string,
  studentId: string,
  guardianId: string,
  relationship: string,
  isPrimaryContact: boolean,
) {
  const existing = await prisma.studentGuardian.findFirst({ where: { studentId, guardianId } });
  if (existing) return existing;
  return prisma.studentGuardian.create({
    data: { organizationId, studentId, guardianId, relationship, isPrimaryContact },
  });
}

async function upsertEnrollment(
  organizationId: string,
  studentId: string,
  programId: string,
  sectionId: string,
  termId: string,
  enrollmentDate: string,
) {
  const existing = await prisma.studentEnrollment.findFirst({ where: { studentId, termId } });
  if (existing) return existing;
  return prisma.studentEnrollment.create({
    data: { organizationId, studentId, programId, sectionId, termId, enrollmentDate: new Date(enrollmentDate) },
  });
}

async function upsertAdmissionApplication(
  organizationId: string,
  applicationCode: string,
  data: {
    programId: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    guardianName?: string;
    guardianPhone?: string;
    score?: number;
  },
) {
  // AdmissionApplication has no natural unique code column (real intake
  // wouldn't need one — this is purely so this demo script can be
  // re-run safely); track it via a note prefix instead of adding a
  // schema-only field just for seeding idempotency.
  const marker = `demo-seed:${applicationCode}`;
  const existing = await prisma.admissionApplication.findFirst({
    where: { organizationId, notes: marker },
  });
  if (existing) return existing;
  return prisma.admissionApplication.create({
    data: {
      organizationId,
      programId: data.programId,
      applicantFirstName: data.firstName,
      applicantLastName: data.lastName,
      dateOfBirth: new Date(data.dateOfBirth),
      guardianName: data.guardianName,
      guardianPhone: data.guardianPhone,
      appliedDate: new Date("2026-06-01"),
      score: data.score,
      notes: marker,
    },
  });
}

async function setApplicationStatus(
  organizationId: string,
  applicationId: string,
  status: "UNDER_REVIEW" | "APPROVED" | "REJECTED",
) {
  await prisma.admissionApplication.update({ where: { id: applicationId }, data: { status } });
  await prisma.admissionStatusHistory.create({
    data: { organizationId, applicationId, status, effectiveDate: new Date() },
  });
}

async function enrollApplication(
  organizationId: string,
  applicationId: string,
  studentCode: string,
  programId: string,
  sectionId: string,
  termId: string,
  enrollmentDate: string,
) {
  const application = await prisma.admissionApplication.findUnique({ where: { id: applicationId } });
  if (!application || application.status === "ENROLLED") return application;

  const student = await upsertStudent(
    organizationId,
    studentCode,
    application.applicantFirstName,
    application.applicantLastName,
    application.dateOfBirth.toISOString().slice(0, 10),
    application.gender ?? undefined,
  );

  if (application.guardianName) {
    const parts = application.guardianName.trim().split(" ");
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ") || parts[0];
    const guardian = await upsertGuardian(organizationId, firstName, lastName, application.guardianPhone ?? "Unknown");
    await upsertStudentGuardian(organizationId, student.id, guardian.id, "Guardian", true);
  }

  await upsertEnrollment(organizationId, student.id, programId, sectionId, termId, enrollmentDate);

  await prisma.admissionApplication.update({
    where: { id: applicationId },
    data: { status: "ENROLLED", enrolledStudentId: student.id },
  });
  await prisma.admissionStatusHistory.create({
    data: {
      organizationId,
      applicationId,
      status: "ENROLLED",
      reason: "Enrolled",
      effectiveDate: new Date(enrollmentDate),
    },
  });

  return student;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
