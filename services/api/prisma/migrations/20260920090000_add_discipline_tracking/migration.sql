-- CreateEnum
CREATE TYPE "DisciplineSeverity" AS ENUM ('MINOR', 'MODERATE', 'MAJOR');

-- CreateTable
CREATE TABLE "discipline_incident_types" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discipline_incident_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discipline_incidents" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "incidentType" TEXT NOT NULL,
    "severity" "DisciplineSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "actionTaken" TEXT,
    "incidentDate" TIMESTAMP(3) NOT NULL,
    "reportedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discipline_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discipline_incident_types_organizationId_idx" ON "discipline_incident_types"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "discipline_incident_types_organizationId_name_key" ON "discipline_incident_types"("organizationId", "name");

-- CreateIndex
CREATE INDEX "discipline_incidents_organizationId_idx" ON "discipline_incidents"("organizationId");

-- CreateIndex
CREATE INDEX "discipline_incidents_studentId_idx" ON "discipline_incidents"("studentId");

-- AddForeignKey
ALTER TABLE "discipline_incident_types" ADD CONSTRAINT "discipline_incident_types_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discipline_incidents" ADD CONSTRAINT "discipline_incidents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discipline_incidents" ADD CONSTRAINT "discipline_incidents_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discipline_incidents" ADD CONSTRAINT "discipline_incidents_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
