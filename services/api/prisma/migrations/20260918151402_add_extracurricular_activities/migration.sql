-- CreateEnum
CREATE TYPE "ExtracurricularActivityLookupKind" AS ENUM ('ACTIVITY_TITLE', 'ACTIVITY_ROLE');

-- CreateTable
CREATE TABLE "extracurricular_activity_lookups" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "ExtracurricularActivityLookupKind" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extracurricular_activity_lookups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extracurricular_activities" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "role" TEXT,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extracurricular_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "extracurricular_activity_lookups_organizationId_idx" ON "extracurricular_activity_lookups"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "extracurricular_activity_lookups_organizationId_kind_name_key" ON "extracurricular_activity_lookups"("organizationId", "kind", "name");

-- CreateIndex
CREATE INDEX "extracurricular_activities_organizationId_idx" ON "extracurricular_activities"("organizationId");

-- CreateIndex
CREATE INDEX "extracurricular_activities_studentId_idx" ON "extracurricular_activities"("studentId");

-- AddForeignKey
ALTER TABLE "extracurricular_activity_lookups" ADD CONSTRAINT "extracurricular_activity_lookups_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracurricular_activities" ADD CONSTRAINT "extracurricular_activities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracurricular_activities" ADD CONSTRAINT "extracurricular_activities_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
