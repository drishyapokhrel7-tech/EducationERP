-- CreateEnum
CREATE TYPE "SubmissionType" AS ENUM ('WRITTEN', 'OBJECTIVE', 'PROJECT', 'PRACTICAL', 'FILE', 'IMAGE', 'PDF', 'LINK', 'TEXT');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'GRADED');

-- CreateEnum
CREATE TYPE "KnowledgeCheckStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teachingAssignmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "submissionType" "SubmissionType" NOT NULL,
    "dueDate" TIMESTAMP(3),
    "allowResubmission" BOOLEAN NOT NULL DEFAULT false,
    "maxScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_submissions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "content" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "score" DOUBLE PRECISION,
    "feedback" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_checks" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teachingAssignmentId" TEXT NOT NULL,
    "syllabusNodeId" TEXT,
    "title" TEXT NOT NULL,
    "durationMinutes" INTEGER,
    "status" "KnowledgeCheckStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_check_questions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "knowledgeCheckId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctOptionIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_check_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_check_attempts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "knowledgeCheckId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_check_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assignments_organizationId_idx" ON "assignments"("organizationId");

-- CreateIndex
CREATE INDEX "assignment_submissions_organizationId_idx" ON "assignment_submissions"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_submissions_assignmentId_studentId_key" ON "assignment_submissions"("assignmentId", "studentId");

-- CreateIndex
CREATE INDEX "knowledge_checks_organizationId_idx" ON "knowledge_checks"("organizationId");

-- CreateIndex
CREATE INDEX "knowledge_check_questions_organizationId_idx" ON "knowledge_check_questions"("organizationId");

-- CreateIndex
CREATE INDEX "knowledge_check_questions_knowledgeCheckId_idx" ON "knowledge_check_questions"("knowledgeCheckId");

-- CreateIndex
CREATE INDEX "knowledge_check_attempts_organizationId_idx" ON "knowledge_check_attempts"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_check_attempts_knowledgeCheckId_studentId_key" ON "knowledge_check_attempts"("knowledgeCheckId", "studentId");

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_teachingAssignmentId_fkey" FOREIGN KEY ("teachingAssignmentId") REFERENCES "teaching_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_checks" ADD CONSTRAINT "knowledge_checks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_checks" ADD CONSTRAINT "knowledge_checks_teachingAssignmentId_fkey" FOREIGN KEY ("teachingAssignmentId") REFERENCES "teaching_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_checks" ADD CONSTRAINT "knowledge_checks_syllabusNodeId_fkey" FOREIGN KEY ("syllabusNodeId") REFERENCES "syllabus_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_check_questions" ADD CONSTRAINT "knowledge_check_questions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_check_questions" ADD CONSTRAINT "knowledge_check_questions_knowledgeCheckId_fkey" FOREIGN KEY ("knowledgeCheckId") REFERENCES "knowledge_checks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_check_attempts" ADD CONSTRAINT "knowledge_check_attempts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_check_attempts" ADD CONSTRAINT "knowledge_check_attempts_knowledgeCheckId_fkey" FOREIGN KEY ("knowledgeCheckId") REFERENCES "knowledge_checks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_check_attempts" ADD CONSTRAINT "knowledge_check_attempts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
