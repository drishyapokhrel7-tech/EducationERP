-- AlterTable
ALTER TABLE "knowledge_check_attempts" ADD COLUMN     "startedAt" TIMESTAMP(3),
ALTER COLUMN "answers" DROP NOT NULL,
ALTER COLUMN "score" DROP NOT NULL,
ALTER COLUMN "submittedAt" DROP NOT NULL,
ALTER COLUMN "submittedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "knowledge_check_answers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "knowledgeCheckAttemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOptionIndex" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_check_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_check_answers_organizationId_idx" ON "knowledge_check_answers"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_check_answers_knowledgeCheckAttemptId_questionId_key" ON "knowledge_check_answers"("knowledgeCheckAttemptId", "questionId");

-- AddForeignKey
ALTER TABLE "knowledge_check_answers" ADD CONSTRAINT "knowledge_check_answers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_check_answers" ADD CONSTRAINT "knowledge_check_answers_knowledgeCheckAttemptId_fkey" FOREIGN KEY ("knowledgeCheckAttemptId") REFERENCES "knowledge_check_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_check_answers" ADD CONSTRAINT "knowledge_check_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "knowledge_check_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
