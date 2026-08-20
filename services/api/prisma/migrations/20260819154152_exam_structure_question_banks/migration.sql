-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('OBJECTIVE', 'SUBJECTIVE');

-- CreateTable
CREATE TABLE "exam_types" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grading_schemes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "bands" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grading_schemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_banks" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "curriculumSubjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "questionBankId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "questionType" "QuestionType" NOT NULL,
    "marks" INTEGER NOT NULL,
    "options" JSONB,
    "correctOptionIndex" INTEGER,
    "modelAnswer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exam_types_organizationId_idx" ON "exam_types"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_types_organizationId_code_key" ON "exam_types"("organizationId", "code");

-- CreateIndex
CREATE INDEX "grading_schemes_organizationId_idx" ON "grading_schemes"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "grading_schemes_organizationId_code_key" ON "grading_schemes"("organizationId", "code");

-- CreateIndex
CREATE INDEX "question_banks_organizationId_idx" ON "question_banks"("organizationId");

-- CreateIndex
CREATE INDEX "question_banks_curriculumSubjectId_idx" ON "question_banks"("curriculumSubjectId");

-- CreateIndex
CREATE INDEX "questions_organizationId_idx" ON "questions"("organizationId");

-- CreateIndex
CREATE INDEX "questions_questionBankId_idx" ON "questions"("questionBankId");

-- AddForeignKey
ALTER TABLE "exam_types" ADD CONSTRAINT "exam_types_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grading_schemes" ADD CONSTRAINT "grading_schemes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_banks" ADD CONSTRAINT "question_banks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_banks" ADD CONSTRAINT "question_banks_curriculumSubjectId_fkey" FOREIGN KEY ("curriculumSubjectId") REFERENCES "curriculum_subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_questionBankId_fkey" FOREIGN KEY ("questionBankId") REFERENCES "question_banks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
