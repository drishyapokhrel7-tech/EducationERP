-- CreateEnum
CREATE TYPE "FineRuleType" AS ENUM ('FIXED', 'PERCENTAGE', 'PER_DAY');

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "invoiceNumber" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "receiptNumber" TEXT;

-- CreateTable
CREATE TABLE "installments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fine_rules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "feeCategoryId" TEXT NOT NULL,
    "type" "FineRuleType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fine_rules_pkey" PRIMARY KEY ("id")
);

-- Backfill existing rows with a real, sequential number (per org, in
-- creation order) before the unique index below is created — a bare
-- ADD COLUMN leaves every existing row NULL, which the app should
-- never actually see for a row it created after this migration, but a
-- pre-existing Invoice/Payment still deserves a real number rather
-- than staying blank forever. The column stays nullable at the schema
-- level (see schema.prisma's comment) rather than NOT NULL, matching
-- this migration's own additive-safe reasoning.
WITH numbered AS (
  SELECT id, "organizationId",
         ROW_NUMBER() OVER (PARTITION BY "organizationId" ORDER BY "createdAt") AS rn
  FROM "invoices"
)
UPDATE "invoices" i
SET "invoiceNumber" = 'INV-' || LPAD(numbered.rn::text, 6, '0')
FROM numbered
WHERE i.id = numbered.id;

WITH numbered AS (
  SELECT id, "organizationId",
         ROW_NUMBER() OVER (PARTITION BY "organizationId" ORDER BY "createdAt") AS rn
  FROM "payments"
)
UPDATE "payments" p
SET "receiptNumber" = 'RCT-' || LPAD(numbered.rn::text, 6, '0')
FROM numbered
WHERE p.id = numbered.id;

-- CreateIndex
CREATE INDEX "installments_organizationId_idx" ON "installments"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "installments_invoiceId_sequence_key" ON "installments"("invoiceId", "sequence");

-- CreateIndex
CREATE INDEX "fine_rules_organizationId_idx" ON "fine_rules"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_organizationId_invoiceNumber_key" ON "invoices"("organizationId", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "payments_organizationId_receiptNumber_key" ON "payments"("organizationId", "receiptNumber");

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fine_rules" ADD CONSTRAINT "fine_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fine_rules" ADD CONSTRAINT "fine_rules_feeCategoryId_fkey" FOREIGN KEY ("feeCategoryId") REFERENCES "fee_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
