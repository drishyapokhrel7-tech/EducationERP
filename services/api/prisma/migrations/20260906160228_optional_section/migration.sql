-- Make Section optional (some institutions don't subdivide a
-- program+semester into sections at all), and give TeachingAssignment
-- a real programId so program-scoping doesn't disappear once
-- sectionId can be null (previously Section was the only thing tying
-- an assignment back to a Program).

-- ── Reconcile stale constraint/index names left over from the
-- Term -> Semester rename (ALTER TABLE/COLUMN RENAME doesn't rename
-- constraint/index names themselves) — metadata-only, no data impact.
ALTER TABLE "semesters" RENAME CONSTRAINT "terms_pkey" TO "semesters_pkey";
ALTER TABLE "semesters" RENAME CONSTRAINT "terms_academicYearId_fkey" TO "semesters_academicYearId_fkey";
ALTER TABLE "semesters" RENAME CONSTRAINT "terms_organizationId_fkey" TO "semesters_organizationId_fkey";
ALTER TABLE "class_schedules" RENAME CONSTRAINT "class_schedules_termId_fkey" TO "class_schedules_semesterId_fkey";
ALTER TABLE "fee_structures" RENAME CONSTRAINT "fee_structures_termId_fkey" TO "fee_structures_semesterId_fkey";
ALTER TABLE "sections" RENAME CONSTRAINT "sections_termId_fkey" TO "sections_semesterId_fkey";
ALTER TABLE "student_enrollments" RENAME CONSTRAINT "student_enrollments_termId_fkey" TO "student_enrollments_semesterId_fkey";
ALTER TABLE "syllabi" RENAME CONSTRAINT "syllabi_termId_fkey" TO "syllabi_semesterId_fkey";
ALTER TABLE "teaching_assignments" RENAME CONSTRAINT "teaching_assignments_termId_fkey" TO "teaching_assignments_semesterId_fkey";
ALTER INDEX "fee_structures_programId_termId_name_key" RENAME TO "fee_structures_programId_semesterId_name_key";
ALTER INDEX "sections_termId_programId_code_key" RENAME TO "sections_semesterId_programId_code_key";
ALTER INDEX "terms_academicYearId_code_key" RENAME TO "semesters_academicYearId_code_key";
ALTER INDEX "terms_organizationId_idx" RENAME TO "semesters_organizationId_idx";
ALTER INDEX "student_enrollments_studentId_termId_key" RENAME TO "student_enrollments_studentId_semesterId_key";
ALTER INDEX "syllabi_curriculumSubjectId_termId_key" RENAME TO "syllabi_curriculumSubjectId_semesterId_key";
ALTER INDEX "teaching_assignments_sectionId_subjectId_termId_key" RENAME TO "teaching_assignments_sectionId_subjectId_semesterId_key";

-- ── Drop the sectionId foreign keys we're about to make nullable
-- (ON DELETE RESTRICT -> ON DELETE SET NULL below).
ALTER TABLE "student_enrollments" DROP CONSTRAINT "student_enrollments_sectionId_fkey";
ALTER TABLE "teaching_assignments" DROP CONSTRAINT "teaching_assignments_sectionId_fkey";
ALTER TABLE "class_schedules" DROP CONSTRAINT "class_schedules_sectionId_fkey";
ALTER TABLE "attendance_sessions" DROP CONSTRAINT "attendance_sessions_sectionId_fkey";
ALTER TABLE "class_sessions" DROP CONSTRAINT "class_sessions_sectionId_fkey";

-- ── sectionId: String -> String?
ALTER TABLE "student_enrollments" ALTER COLUMN "sectionId" DROP NOT NULL;
ALTER TABLE "teaching_assignments" ALTER COLUMN "sectionId" DROP NOT NULL;
ALTER TABLE "class_schedules" ALTER COLUMN "sectionId" DROP NOT NULL;
ALTER TABLE "attendance_sessions" ALTER COLUMN "sectionId" DROP NOT NULL;
ALTER TABLE "class_sessions" ALTER COLUMN "sectionId" DROP NOT NULL;

-- ── teaching_assignments.programId: new, always-populated column.
-- Added nullable first, backfilled from the existing (always-present,
-- pre-this-migration) section on every current row, then locked to
-- NOT NULL — every row that exists before this migration runs has a
-- sectionId, so this backfill has 100% coverage.
ALTER TABLE "teaching_assignments" ADD COLUMN "programId" TEXT;
UPDATE "teaching_assignments" ta
SET "programId" = s."programId"
FROM "sections" s
WHERE ta."sectionId" = s."id";
ALTER TABLE "teaching_assignments" ALTER COLUMN "programId" SET NOT NULL;

-- ── Re-add the sectionId foreign keys as SET NULL (a deleted Section
-- clears the reference instead of blocking the delete or cascading),
-- and add the new programId foreign key.
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "class_schedules" ADD CONSTRAINT "class_schedules_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
