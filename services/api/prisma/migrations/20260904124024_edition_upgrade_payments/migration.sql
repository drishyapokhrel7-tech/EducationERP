-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "editionExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "edition_upgrade_payments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "targetEdition" "Edition" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "transactionUuid" TEXT NOT NULL,
    "status" "EsewaTransactionStatus" NOT NULL DEFAULT 'INITIATED',
    "esewaRefId" TEXT,
    "initiatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "edition_upgrade_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "edition_upgrade_payments_transactionUuid_key" ON "edition_upgrade_payments"("transactionUuid");

-- CreateIndex
CREATE INDEX "edition_upgrade_payments_organizationId_idx" ON "edition_upgrade_payments"("organizationId");

-- AddForeignKey
ALTER TABLE "edition_upgrade_payments" ADD CONSTRAINT "edition_upgrade_payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edition_upgrade_payments" ADD CONSTRAINT "edition_upgrade_payments_initiatedBy_fkey" FOREIGN KEY ("initiatedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
