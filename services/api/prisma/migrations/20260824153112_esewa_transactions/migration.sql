-- CreateEnum
CREATE TYPE "EsewaTransactionStatus" AS ENUM ('INITIATED', 'COMPLETE', 'FAILED', 'CANCELED');

-- CreateTable
CREATE TABLE "esewa_transactions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "transactionUuid" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "EsewaTransactionStatus" NOT NULL DEFAULT 'INITIATED',
    "esewaRefId" TEXT,
    "initiatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "esewa_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "esewa_transactions_transactionUuid_key" ON "esewa_transactions"("transactionUuid");

-- CreateIndex
CREATE INDEX "esewa_transactions_organizationId_idx" ON "esewa_transactions"("organizationId");

-- CreateIndex
CREATE INDEX "esewa_transactions_invoiceId_idx" ON "esewa_transactions"("invoiceId");

-- AddForeignKey
ALTER TABLE "esewa_transactions" ADD CONSTRAINT "esewa_transactions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esewa_transactions" ADD CONSTRAINT "esewa_transactions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esewa_transactions" ADD CONSTRAINT "esewa_transactions_initiatedBy_fkey" FOREIGN KEY ("initiatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
