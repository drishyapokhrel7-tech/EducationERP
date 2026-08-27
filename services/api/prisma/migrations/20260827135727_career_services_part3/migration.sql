-- CreateEnum
CREATE TYPE "OpportunityType" AS ENUM ('JOB', 'INTERNSHIP');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'REJECTED', 'ACCEPTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('EMPLOYED', 'SELF_EMPLOYED', 'FURTHER_STUDY', 'UNEMPLOYED_SEEKING', 'UNEMPLOYED_NOT_SEEKING', 'UNKNOWN');

-- CreateTable
CREATE TABLE "career_opportunities" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "postedByAlumniProfileId" TEXT,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "OpportunityType" NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "career_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_applications" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "applicantStudentId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "coverNote" TEXT,
    "reviewNotes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "career_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_services" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "career_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graduate_outcomes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "alumniProfileId" TEXT NOT NULL,
    "employmentStatus" "EmploymentStatus" NOT NULL,
    "employerOrInstitution" TEXT,
    "fieldRelatedToStudy" BOOLEAN,
    "notes" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "graduate_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "career_opportunities_organizationId_idx" ON "career_opportunities"("organizationId");

-- CreateIndex
CREATE INDEX "career_opportunities_companyId_idx" ON "career_opportunities"("companyId");

-- CreateIndex
CREATE INDEX "career_applications_organizationId_idx" ON "career_applications"("organizationId");

-- CreateIndex
CREATE INDEX "career_applications_applicantStudentId_idx" ON "career_applications"("applicantStudentId");

-- CreateIndex
CREATE UNIQUE INDEX "career_applications_opportunityId_applicantStudentId_key" ON "career_applications"("opportunityId", "applicantStudentId");

-- CreateIndex
CREATE INDEX "career_services_organizationId_idx" ON "career_services"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "graduate_outcomes_alumniProfileId_key" ON "graduate_outcomes"("alumniProfileId");

-- CreateIndex
CREATE INDEX "graduate_outcomes_organizationId_idx" ON "graduate_outcomes"("organizationId");

-- AddForeignKey
ALTER TABLE "career_opportunities" ADD CONSTRAINT "career_opportunities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_opportunities" ADD CONSTRAINT "career_opportunities_postedByAlumniProfileId_fkey" FOREIGN KEY ("postedByAlumniProfileId") REFERENCES "alumni_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_opportunities" ADD CONSTRAINT "career_opportunities_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "alumni_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_applications" ADD CONSTRAINT "career_applications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_applications" ADD CONSTRAINT "career_applications_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "career_opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_applications" ADD CONSTRAINT "career_applications_applicantStudentId_fkey" FOREIGN KEY ("applicantStudentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_services" ADD CONSTRAINT "career_services_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graduate_outcomes" ADD CONSTRAINT "graduate_outcomes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graduate_outcomes" ADD CONSTRAINT "graduate_outcomes_alumniProfileId_fkey" FOREIGN KEY ("alumniProfileId") REFERENCES "alumni_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
