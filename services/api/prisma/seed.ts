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
// first four, Phase 2 slice 2a added the org-hierarchy six, slice 2b
// added the staff six, slice 2c added subject/curriculum (curriculum
// covers curriculum_subjects too), slice 2d added student/guardian/
// enrollment (guardian covers student_guardians attachment; enrollment
// covers both creating and status-changing a StudentEnrollment), slice
// 2e added admission (covers both status updates and the enroll action),
// Phase 3 slice 3a added room/period/teaching_assignment/class_schedule,
// slice 3b added attendance (covers sessions/marking/corrections) and
// staff_attendance (a separate resource — different sub-domain, same
// reasoning as enrollment vs admission being separate resources), slice
// 3c added syllabus (covers the node tree + learning objectives) and
// lesson_plan (separate resource — planning content is a distinct
// teacher-facing action from the syllabus structure itself), slice 3d
// added class_session (covers sessions, materials, and completion —
// deliberately separate from both attendance and syllabus, matching
// the plan's own domain split), slice 3e added assignment (covers
// submissions/grading) and knowledge_check (covers questions/attempts —
// separate resource, same reasoning as every prior slice's domain
// splits), slice 3f added dashboard (a single resource covering the
// teacher/student/parent aggregation views — read-only, no CRUD, so one
// resource with :view is enough rather than one per audience).
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
  "staff_type",
  "designation",
  "employee",
  "employment_history",
  "qualification",
  "teacher_profile",
  "subject",
  "curriculum",
  "student",
  "guardian",
  "enrollment",
  "admission",
  "room",
  "period",
  "teaching_assignment",
  "class_schedule",
  "attendance",
  "staff_attendance",
  "syllabus",
  "lesson_plan",
  "class_session",
  "assignment",
  "knowledge_check",
  "dashboard",
  "exam_type",
  "grading_scheme",
  "question_bank",
  "question",
  "exam",
  "exam_subject",
  "exam_schedule",
  "exam_room",
  "exam_attempt",
  "marks",
  "grade",
  "report_card",
  // Phase 6 slice 6a added biometric_policy (the org-wide enable/
  // disable + retention/threshold settings) and biometric_enrollment
  // (per-person consent records) — same as every resource added since
  // Phase 1, only Super Admin/Organization Admin get permissions here
  // (below), which happens to match the architecture doc's explicit
  // "strict biometric access control" requirement for this one
  // resource, not a special case added just for it.
  "biometric_policy",
  "biometric_enrollment",
  // Phase 6 slice 6c added camera (registration + the capture-ingestion
  // endpoint) and face_match_event (the review queue) — same
  // Super-Admin/Organization-Admin-only reasoning as 6a's two.
  "camera",
  "face_match_event",
  // Phase 7 slice 7a-1 added the Finance domain — one resource per
  // domain concept (child/junction tables like fee_structure_items or
  // invoice_items fold into their parent, matching the granularity
  // established for curriculum_subjects/exam_subjects). Super
  // Admin/Organization Admin only, same as every resource so far — a
  // dedicated Accountant role is a future refinement, not implied by
  // this slice.
  "fee_category",
  "fee_structure",
  "student_fee_assignment",
  "invoice",
  "payment",
  "scholarship",
  "discount",
  "refund",
  // Roles & Permissions admin module — "user" and "role" were already
  // reserved here since Phase 1 (Super Admin/Organization Admin already
  // had every action on both granted, just with no API ever built on
  // top). audit_log is the one genuinely new resource this slice adds —
  // only `view` is actually wired to an endpoint, seeded with the full
  // matrix anyway for consistency with every other resource here.
  "audit_log",
  // Phase 7 slice 7b-1 (HR & Payroll, part 1: Leave Management) —
  // leave_request folds balance-allocation actions in too, same
  // "closely-related concepts share one resource" precedent as
  // financial_transactions folding under invoice.
  "leave_type",
  "leave_request",
  // Phase 7 slice 7b-2 (HR & Payroll, part 2: Payroll) — payroll folds
  // payroll_items in too, same folding precedent as leave_request above.
  "salary_structure",
  "payroll",
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
