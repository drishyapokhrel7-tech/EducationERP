-- CreateEnum
CREATE TYPE "AlumniSurveyStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MentorshipStatus" AS ENUM ('REQUESTED', 'ACTIVE', 'DECLINED', 'COMPLETED');

-- CreateTable
CREATE TABLE "alumni_surveys" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "questions" JSONB NOT NULL,
    "status" "AlumniSurveyStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alumni_surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alumni_survey_responses" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "alumniProfileId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alumni_survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alumni_mentorship" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "mentorAlumniProfileId" TEXT NOT NULL,
    "menteeStudentId" TEXT NOT NULL,
    "topic" TEXT,
    "status" "MentorshipStatus" NOT NULL DEFAULT 'REQUESTED',
    "notes" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "alumni_mentorship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alumni_achievements" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "alumniProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "achievedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alumni_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alumni_surveys_organizationId_idx" ON "alumni_surveys"("organizationId");

-- CreateIndex
CREATE INDEX "alumni_survey_responses_organizationId_idx" ON "alumni_survey_responses"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "alumni_survey_responses_surveyId_alumniProfileId_key" ON "alumni_survey_responses"("surveyId", "alumniProfileId");

-- CreateIndex
CREATE INDEX "alumni_mentorship_organizationId_idx" ON "alumni_mentorship"("organizationId");

-- CreateIndex
CREATE INDEX "alumni_mentorship_mentorAlumniProfileId_idx" ON "alumni_mentorship"("mentorAlumniProfileId");

-- CreateIndex
CREATE INDEX "alumni_mentorship_menteeStudentId_idx" ON "alumni_mentorship"("menteeStudentId");

-- CreateIndex
CREATE INDEX "alumni_achievements_organizationId_idx" ON "alumni_achievements"("organizationId");

-- CreateIndex
CREATE INDEX "alumni_achievements_alumniProfileId_idx" ON "alumni_achievements"("alumniProfileId");

-- AddForeignKey
ALTER TABLE "alumni_surveys" ADD CONSTRAINT "alumni_surveys_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumni_survey_responses" ADD CONSTRAINT "alumni_survey_responses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumni_survey_responses" ADD CONSTRAINT "alumni_survey_responses_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "alumni_surveys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumni_survey_responses" ADD CONSTRAINT "alumni_survey_responses_alumniProfileId_fkey" FOREIGN KEY ("alumniProfileId") REFERENCES "alumni_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumni_mentorship" ADD CONSTRAINT "alumni_mentorship_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumni_mentorship" ADD CONSTRAINT "alumni_mentorship_mentorAlumniProfileId_fkey" FOREIGN KEY ("mentorAlumniProfileId") REFERENCES "alumni_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumni_mentorship" ADD CONSTRAINT "alumni_mentorship_menteeStudentId_fkey" FOREIGN KEY ("menteeStudentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumni_achievements" ADD CONSTRAINT "alumni_achievements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumni_achievements" ADD CONSTRAINT "alumni_achievements_alumniProfileId_fkey" FOREIGN KEY ("alumniProfileId") REFERENCES "alumni_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
