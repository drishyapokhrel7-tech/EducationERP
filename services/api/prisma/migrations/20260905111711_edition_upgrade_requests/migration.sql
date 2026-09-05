-- CreateEnum
CREATE TYPE "EditionUpgradeRequestStatus" AS ENUM ('PENDING', 'RESOLVED');

-- CreateTable
CREATE TABLE "edition_upgrade_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "targetEdition" "Edition" NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "notes" TEXT,
    "status" "EditionUpgradeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "edition_upgrade_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "edition_upgrade_requests_organizationId_idx" ON "edition_upgrade_requests"("organizationId");

-- AddForeignKey
ALTER TABLE "edition_upgrade_requests" ADD CONSTRAINT "edition_upgrade_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edition_upgrade_requests" ADD CONSTRAINT "edition_upgrade_requests_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
