-- Split Term into two genuinely separate concepts:
--   Semester — the enrollment-side academic period (renamed from Term,
--     zero data loss — every organization's existing rows, including
--     Tribhuvan University's 76 real student enrollments, carry
--     forward under the new name unchanged).
--   TermExam — a new, exam-only period ("Mid Term Exam," "Internal
--     Exam," "Pre-board Exam") scoped per Semester. Exam now
--     references TermExam instead of Semester directly.
--
-- Part A is a pure rename: no row is deleted, no data is lost.
-- Part B deletes existing Exam data (and everything that cascades
-- from it) before retargeting Exam at the new TermExam entity —
-- confirmed via a direct database count beforehand that this only
-- ever touches the synthetic seed-demo org's data and leftover e2e
-- test fixtures; zero real customer organizations have any Exam data
-- today.

-- ── Part A: rename Term -> Semester (non-destructive) ──────────────

ALTER TABLE "terms" RENAME TO "semesters";

ALTER TABLE "sections" RENAME COLUMN "termId" TO "semesterId";
ALTER TABLE "student_enrollments" RENAME COLUMN "termId" TO "semesterId";
ALTER TABLE "teaching_assignments" RENAME COLUMN "termId" TO "semesterId";
ALTER TABLE "class_schedules" RENAME COLUMN "termId" TO "semesterId";
ALTER TABLE "syllabi" RENAME COLUMN "termId" TO "semesterId";
ALTER TABLE "fee_structures" RENAME COLUMN "termId" TO "semesterId";

-- ── Part B: delete existing Exam data, then retarget Exam at a new
--    TermExam entity instead of Semester (destructive, confirmed
--    real-data-costless — see comment above) ────────────────────────

DELETE FROM "answers";
DELETE FROM "marks";
DELETE FROM "grades";
DELETE FROM "exam_attempts";
DELETE FROM "exam_rooms";
DELETE FROM "exam_schedules";
DELETE FROM "exam_subjects";
DELETE FROM "report_cards";
DELETE FROM "exams";

-- CreateTable
CREATE TABLE "term_exams" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "term_exams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "term_exams_semesterId_code_key" ON "term_exams"("semesterId", "code");

-- CreateIndex
CREATE INDEX "term_exams_organizationId_idx" ON "term_exams"("organizationId");

-- AddForeignKey
ALTER TABLE "term_exams" ADD CONSTRAINT "term_exams_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "term_exams" ADD CONSTRAINT "term_exams_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Retarget exams.termId -> exams.termExamId (table is empty at this
-- point, so this is a plain drop-and-add, not a data-preserving
-- rename — there is nothing left to preserve).
ALTER TABLE "exams" DROP CONSTRAINT "exams_termId_fkey";
DROP INDEX IF EXISTS "exams_termId_idx";
ALTER TABLE "exams" DROP COLUMN "termId";
ALTER TABLE "exams" ADD COLUMN "termExamId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "exams_termExamId_idx" ON "exams"("termExamId");

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_termExamId_fkey" FOREIGN KEY ("termExamId") REFERENCES "term_exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
