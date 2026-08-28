import { PrismaClient } from "@prisma/client";

// A starting point, not a fixed set — every row this creates is a
// plain Faculty/Department/Program row the admin can rename, remove,
// or add to afterward via the normal org-structure edit/delete UI
// (same "starting point, not a fixed set" precedent as
// StaffService.DEFAULT_STAFF_TYPES/DEFAULT_DESIGNATIONS). Modeled on
// the real program lineup and Tribhuvan University affiliation of
// Prime College (https://prime.edu.np/) generalized to the grouping
// most TU-affiliated Nepali colleges use (Faculty of Management /
// Faculty of Science & Technology) — not literal text copied from any
// site, just the same publicly-known, unavoidably standard degree
// names and TU-defined entrance-exam labels every such college shares.
export const DEFAULT_COLLEGE_STRUCTURE: {
  faculty: { name: string; code: string };
  departments: {
    name: string;
    code: string;
    programs: {
      name: string;
      code: string;
      level: string;
      durationSemesters: number;
      creditHours?: number;
      entranceExam: string;
    }[];
  }[];
}[] = [
  {
    faculty: { name: "Faculty of Management", code: "MGMT" },
    departments: [
      {
        name: "Department of Business Studies",
        code: "MGMT-BUS",
        programs: [
          {
            name: "Bachelor of Business Studies",
            code: "BBS",
            level: "Bachelor",
            durationSemesters: 8,
            entranceExam: "None",
          },
          {
            name: "Bachelor of Business Management",
            code: "BBM",
            level: "Bachelor",
            durationSemesters: 8,
            creditHours: 120,
            entranceExam: "CMAT",
          },
          {
            name: "Bachelor of Business Administration",
            code: "BBA",
            level: "Bachelor",
            durationSemesters: 8,
            creditHours: 120,
            entranceExam: "CMAT",
          },
          {
            name: "Master of Business Studies",
            code: "MBS",
            level: "Master",
            durationSemesters: 4,
            creditHours: 60,
            entranceExam: "CMAT (MBS)",
          },
        ],
      },
      {
        name: "Department of Information Management",
        code: "MGMT-IT",
        programs: [
          {
            name: "Bachelor of Information Technology Management",
            code: "BITM",
            level: "Bachelor",
            durationSemesters: 8,
            creditHours: 126,
            entranceExam: "CMAT",
          },
        ],
      },
    ],
  },
  {
    faculty: { name: "Faculty of Science & Technology", code: "SCITECH" },
    departments: [
      {
        name: "Department of Computer Science",
        code: "SCITECH-CS",
        programs: [
          {
            name: "Bachelor of Science in Computer Science and Information Technology",
            code: "BSCCSIT",
            level: "Bachelor",
            durationSemesters: 8,
            creditHours: 126,
            entranceExam: "IOST",
          },
          {
            name: "Bachelor of Computer Applications",
            code: "BCA",
            level: "Bachelor",
            durationSemesters: 8,
            creditHours: 126,
            entranceExam: "BCA",
          },
        ],
      },
    ],
  },
];

// Called once, right after a COLLEGE-type Campus is created
// (OrganizationsService.createCampus), inside that same withTenant
// transaction — plain creates, not upserts, since this only ever runs
// against a campus that was just created and so cannot already have
// any of these rows.
export async function seedCollegeStructure(
  tx: PrismaClient,
  organizationId: string,
  campusId: string,
): Promise<void> {
  for (const facultyDef of DEFAULT_COLLEGE_STRUCTURE) {
    const faculty = await tx.faculty.create({
      data: { organizationId, campusId, name: facultyDef.faculty.name, code: facultyDef.faculty.code },
    });
    for (const departmentDef of facultyDef.departments) {
      const department = await tx.department.create({
        data: { organizationId, facultyId: faculty.id, name: departmentDef.name, code: departmentDef.code },
      });
      for (const programDef of departmentDef.programs) {
        await tx.program.create({
          data: {
            organizationId,
            departmentId: department.id,
            name: programDef.name,
            code: programDef.code,
            level: programDef.level,
            durationSemesters: programDef.durationSemesters,
            creditHours: programDef.creditHours,
            entranceExam: programDef.entranceExam,
          },
        });
      }
    }
  }
}
