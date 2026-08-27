-- CreateTable
CREATE TABLE "alumni_profiles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "graduationYear" INTEGER NOT NULL,
    "currentOccupation" TEXT,
    "currentEmployer" TEXT,
    "currentLocation" TEXT,
    "bio" TEXT,
    "linkedinUrl" TEXT,
    "isPubliclyVisible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alumni_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alumni_education" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "alumniProfileId" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "fieldOfStudy" TEXT,
    "startYear" INTEGER,
    "endYear" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alumni_education_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alumni_companies" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alumni_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alumni_career_history" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "alumniProfileId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alumni_career_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alumni_skills" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "alumniProfileId" TEXT NOT NULL,
    "skillName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alumni_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alumni_certifications" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "alumniProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuingOrganization" TEXT,
    "issuedDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "credentialUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alumni_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alumni_profiles_studentId_key" ON "alumni_profiles"("studentId");

-- CreateIndex
CREATE INDEX "alumni_profiles_organizationId_idx" ON "alumni_profiles"("organizationId");

-- CreateIndex
CREATE INDEX "alumni_education_organizationId_idx" ON "alumni_education"("organizationId");

-- CreateIndex
CREATE INDEX "alumni_education_alumniProfileId_idx" ON "alumni_education"("alumniProfileId");

-- CreateIndex
CREATE INDEX "alumni_companies_organizationId_idx" ON "alumni_companies"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "alumni_companies_organizationId_name_key" ON "alumni_companies"("organizationId", "name");

-- CreateIndex
CREATE INDEX "alumni_career_history_organizationId_idx" ON "alumni_career_history"("organizationId");

-- CreateIndex
CREATE INDEX "alumni_career_history_alumniProfileId_idx" ON "alumni_career_history"("alumniProfileId");

-- CreateIndex
CREATE INDEX "alumni_skills_organizationId_idx" ON "alumni_skills"("organizationId");

-- CreateIndex
CREATE INDEX "alumni_skills_alumniProfileId_idx" ON "alumni_skills"("alumniProfileId");

-- CreateIndex
CREATE INDEX "alumni_certifications_organizationId_idx" ON "alumni_certifications"("organizationId");

-- CreateIndex
CREATE INDEX "alumni_certifications_alumniProfileId_idx" ON "alumni_certifications"("alumniProfileId");

-- AddForeignKey
ALTER TABLE "alumni_profiles" ADD CONSTRAINT "alumni_profiles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumni_profiles" ADD CONSTRAINT "alumni_profiles_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumni_education" ADD CONSTRAINT "alumni_education_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumni_education" ADD CONSTRAINT "alumni_education_alumniProfileId_fkey" FOREIGN KEY ("alumniProfileId") REFERENCES "alumni_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumni_companies" ADD CONSTRAINT "alumni_companies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumni_career_history" ADD CONSTRAINT "alumni_career_history_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumni_career_history" ADD CONSTRAINT "alumni_career_history_alumniProfileId_fkey" FOREIGN KEY ("alumniProfileId") REFERENCES "alumni_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumni_career_history" ADD CONSTRAINT "alumni_career_history_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "alumni_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumni_skills" ADD CONSTRAINT "alumni_skills_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumni_skills" ADD CONSTRAINT "alumni_skills_alumniProfileId_fkey" FOREIGN KEY ("alumniProfileId") REFERENCES "alumni_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumni_certifications" ADD CONSTRAINT "alumni_certifications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumni_certifications" ADD CONSTRAINT "alumni_certifications_alumniProfileId_fkey" FOREIGN KEY ("alumniProfileId") REFERENCES "alumni_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
