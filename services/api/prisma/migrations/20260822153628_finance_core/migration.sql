-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CHEQUE', 'ESEWA');

-- CreateEnum
CREATE TYPE "FinancialTransactionType" AS ENUM ('INVOICE_CREATED', 'PAYMENT_RECORDED', 'DISCOUNT_APPLIED', 'SCHOLARSHIP_APPLIED', 'REFUND_ISSUED');

-- CreateTable
CREATE TABLE "fee_categories" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_structures" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_structure_items" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "feeStructureId" TEXT NOT NULL,
    "feeCategoryId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "fee_structure_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_fee_assignments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "feeStructureId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,

    CONSTRAINT "student_fee_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "feeCategoryId" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "recordedBy" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scholarships" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "percentage" DOUBLE PRECISION,
    "amount" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scholarships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_scholarships" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "scholarshipId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "student_scholarships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discounts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "scholarshipId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "appliedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "processedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_transactions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "FinancialTransactionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "invoiceId" TEXT,
    "paymentId" TEXT,
    "discountId" TEXT,
    "refundId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fee_categories_organizationId_idx" ON "fee_categories"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "fee_categories_organizationId_code_key" ON "fee_categories"("organizationId", "code");

-- CreateIndex
CREATE INDEX "fee_structures_organizationId_idx" ON "fee_structures"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "fee_structures_programId_termId_name_key" ON "fee_structures"("programId", "termId", "name");

-- CreateIndex
CREATE INDEX "fee_structure_items_organizationId_idx" ON "fee_structure_items"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "fee_structure_items_feeStructureId_feeCategoryId_key" ON "fee_structure_items"("feeStructureId", "feeCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "student_fee_assignments_invoiceId_key" ON "student_fee_assignments"("invoiceId");

-- CreateIndex
CREATE INDEX "student_fee_assignments_organizationId_idx" ON "student_fee_assignments"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "student_fee_assignments_studentEnrollmentId_feeStructureId_key" ON "student_fee_assignments"("studentEnrollmentId", "feeStructureId");

-- CreateIndex
CREATE INDEX "invoices_organizationId_idx" ON "invoices"("organizationId");

-- CreateIndex
CREATE INDEX "invoice_items_organizationId_idx" ON "invoice_items"("organizationId");

-- CreateIndex
CREATE INDEX "payments_organizationId_idx" ON "payments"("organizationId");

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");

-- CreateIndex
CREATE INDEX "scholarships_organizationId_idx" ON "scholarships"("organizationId");

-- CreateIndex
CREATE INDEX "student_scholarships_organizationId_idx" ON "student_scholarships"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "student_scholarships_studentId_scholarshipId_key" ON "student_scholarships"("studentId", "scholarshipId");

-- CreateIndex
CREATE INDEX "discounts_organizationId_idx" ON "discounts"("organizationId");

-- CreateIndex
CREATE INDEX "refunds_organizationId_idx" ON "refunds"("organizationId");

-- CreateIndex
CREATE INDEX "financial_transactions_organizationId_idx" ON "financial_transactions"("organizationId");

-- AddForeignKey
ALTER TABLE "fee_categories" ADD CONSTRAINT "fee_categories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_termId_fkey" FOREIGN KEY ("termId") REFERENCES "terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_structure_items" ADD CONSTRAINT "fee_structure_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_structure_items" ADD CONSTRAINT "fee_structure_items_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "fee_structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_structure_items" ADD CONSTRAINT "fee_structure_items_feeCategoryId_fkey" FOREIGN KEY ("feeCategoryId") REFERENCES "fee_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_assignments" ADD CONSTRAINT "student_fee_assignments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_assignments" ADD CONSTRAINT "student_fee_assignments_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "student_enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_assignments" ADD CONSTRAINT "student_fee_assignments_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "fee_structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_assignments" ADD CONSTRAINT "student_fee_assignments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_assignments" ADD CONSTRAINT "student_fee_assignments_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "student_enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_feeCategoryId_fkey" FOREIGN KEY ("feeCategoryId") REFERENCES "fee_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scholarships" ADD CONSTRAINT "scholarships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_scholarships" ADD CONSTRAINT "student_scholarships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_scholarships" ADD CONSTRAINT "student_scholarships_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_scholarships" ADD CONSTRAINT "student_scholarships_scholarshipId_fkey" FOREIGN KEY ("scholarshipId") REFERENCES "scholarships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_scholarshipId_fkey" FOREIGN KEY ("scholarshipId") REFERENCES "scholarships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_appliedBy_fkey" FOREIGN KEY ("appliedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_processedBy_fkey" FOREIGN KEY ("processedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "discounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "refunds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
