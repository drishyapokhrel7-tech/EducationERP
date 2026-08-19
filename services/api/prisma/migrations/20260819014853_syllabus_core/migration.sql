-- CreateEnum
CREATE TYPE "SyllabusNodeLevel" AS ENUM ('UNIT', 'CHAPTER', 'TOPIC', 'SUBTOPIC');

-- CreateTable
CREATE TABLE "syllabi" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "curriculumSubjectId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "syllabi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "syllabus_nodes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "syllabusId" TEXT NOT NULL,
    "parentId" TEXT,
    "level" "SyllabusNodeLevel" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "syllabus_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_objectives" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "syllabusNodeId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_plans" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teachingAssignmentId" TEXT NOT NULL,
    "syllabusNodeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objectives" TEXT NOT NULL,
    "materials" TEXT,
    "plannedDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "syllabi_organizationId_idx" ON "syllabi"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "syllabi_curriculumSubjectId_termId_key" ON "syllabi"("curriculumSubjectId", "termId");

-- CreateIndex
CREATE INDEX "syllabus_nodes_organizationId_idx" ON "syllabus_nodes"("organizationId");

-- CreateIndex
CREATE INDEX "syllabus_nodes_syllabusId_idx" ON "syllabus_nodes"("syllabusId");

-- CreateIndex
CREATE INDEX "syllabus_nodes_parentId_idx" ON "syllabus_nodes"("parentId");

-- CreateIndex
CREATE INDEX "learning_objectives_organizationId_idx" ON "learning_objectives"("organizationId");

-- CreateIndex
CREATE INDEX "learning_objectives_syllabusNodeId_idx" ON "learning_objectives"("syllabusNodeId");

-- CreateIndex
CREATE INDEX "lesson_plans_organizationId_idx" ON "lesson_plans"("organizationId");

-- CreateIndex
CREATE INDEX "lesson_plans_teachingAssignmentId_idx" ON "lesson_plans"("teachingAssignmentId");

-- AddForeignKey
ALTER TABLE "syllabi" ADD CONSTRAINT "syllabi_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabi" ADD CONSTRAINT "syllabi_curriculumSubjectId_fkey" FOREIGN KEY ("curriculumSubjectId") REFERENCES "curriculum_subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabi" ADD CONSTRAINT "syllabi_termId_fkey" FOREIGN KEY ("termId") REFERENCES "terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus_nodes" ADD CONSTRAINT "syllabus_nodes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus_nodes" ADD CONSTRAINT "syllabus_nodes_syllabusId_fkey" FOREIGN KEY ("syllabusId") REFERENCES "syllabi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus_nodes" ADD CONSTRAINT "syllabus_nodes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "syllabus_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_objectives" ADD CONSTRAINT "learning_objectives_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_objectives" ADD CONSTRAINT "learning_objectives_syllabusNodeId_fkey" FOREIGN KEY ("syllabusNodeId") REFERENCES "syllabus_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_teachingAssignmentId_fkey" FOREIGN KEY ("teachingAssignmentId") REFERENCES "teaching_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_syllabusNodeId_fkey" FOREIGN KEY ("syllabusNodeId") REFERENCES "syllabus_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
