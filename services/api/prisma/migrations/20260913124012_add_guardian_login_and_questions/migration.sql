-- AlterTable
ALTER TABLE "guardians" ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "guardian_questions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teachingAssignmentId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "answer" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guardian_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guardian_questions_organizationId_idx" ON "guardian_questions"("organizationId");

-- CreateIndex
CREATE INDEX "guardian_questions_guardianId_idx" ON "guardian_questions"("guardianId");

-- CreateIndex
CREATE INDEX "guardian_questions_teachingAssignmentId_idx" ON "guardian_questions"("teachingAssignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "guardians_userId_key" ON "guardians"("userId");

-- AddForeignKey
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_questions" ADD CONSTRAINT "guardian_questions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_questions" ADD CONSTRAINT "guardian_questions_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "guardians"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_questions" ADD CONSTRAINT "guardian_questions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_questions" ADD CONSTRAINT "guardian_questions_teachingAssignmentId_fkey" FOREIGN KEY ("teachingAssignmentId") REFERENCES "teaching_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

