-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'PAID');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "referredByPartnerId" TEXT;

-- CreateTable
CREATE TABLE "marketing_partners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "referralCode" TEXT NOT NULL,
    "payoutAccount" TEXT,
    "commissionRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_commissions" (
    "id" TEXT NOT NULL,
    "marketingPartnerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "upgradeRequestId" TEXT,
    "depositedAmount" DECIMAL(12,2) NOT NULL,
    "commissionRatePercent" DECIMAL(5,2) NOT NULL,
    "commissionAmount" DECIMAL(12,2) NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "paidByPlatformAdminId" TEXT,

    CONSTRAINT "marketing_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketing_partners_referralCode_key" ON "marketing_partners"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_commissions_upgradeRequestId_key" ON "marketing_commissions"("upgradeRequestId");

-- CreateIndex
CREATE INDEX "marketing_commissions_marketingPartnerId_idx" ON "marketing_commissions"("marketingPartnerId");

-- CreateIndex
CREATE INDEX "marketing_commissions_organizationId_idx" ON "marketing_commissions"("organizationId");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_referredByPartnerId_fkey" FOREIGN KEY ("referredByPartnerId") REFERENCES "marketing_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_commissions" ADD CONSTRAINT "marketing_commissions_marketingPartnerId_fkey" FOREIGN KEY ("marketingPartnerId") REFERENCES "marketing_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_commissions" ADD CONSTRAINT "marketing_commissions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_commissions" ADD CONSTRAINT "marketing_commissions_upgradeRequestId_fkey" FOREIGN KEY ("upgradeRequestId") REFERENCES "edition_upgrade_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_commissions" ADD CONSTRAINT "marketing_commissions_paidByPlatformAdminId_fkey" FOREIGN KEY ("paidByPlatformAdminId") REFERENCES "platform_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
