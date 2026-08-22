-- CreateEnum
CREATE TYPE "FaceEnrollmentStatus" AS ENUM ('ACTIVE', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "biometric_policies" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "retentionDays" INTEGER NOT NULL DEFAULT 365,
    "matchConfidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "biometric_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "face_enrollments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "studentId" TEXT,
    "staffId" TEXT,
    "status" "FaceEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "consentGivenAt" TIMESTAMP(3) NOT NULL,
    "consentGivenBy" TEXT NOT NULL,
    "consentWithdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "face_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "biometric_policies_organizationId_key" ON "biometric_policies"("organizationId");

-- CreateIndex
CREATE INDEX "face_enrollments_organizationId_idx" ON "face_enrollments"("organizationId");

-- CreateIndex
CREATE INDEX "face_enrollments_studentId_idx" ON "face_enrollments"("studentId");

-- CreateIndex
CREATE INDEX "face_enrollments_staffId_idx" ON "face_enrollments"("staffId");

-- AddForeignKey
ALTER TABLE "biometric_policies" ADD CONSTRAINT "biometric_policies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_enrollments" ADD CONSTRAINT "face_enrollments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_enrollments" ADD CONSTRAINT "face_enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_enrollments" ADD CONSTRAINT "face_enrollments_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
