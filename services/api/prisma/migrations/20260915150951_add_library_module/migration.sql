-- CreateEnum
CREATE TYPE "LibraryReservationStatus" AS ENUM ('PENDING', 'READY', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LibraryFineReason" AS ENUM ('LATE_RETURN', 'LOST', 'DAMAGED');

-- CreateEnum
CREATE TYPE "LibraryFineStatus" AS ENUM ('PENDING', 'PAID', 'WAIVED');

-- CreateTable
CREATE TABLE "book_categories" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "book_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "books" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "categoryId" TEXT,
    "isbn" TEXT,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "publisher" TEXT,
    "edition" TEXT,
    "shelfLocation" TEXT,
    "coverImageUrl" TEXT,
    "totalCopies" INTEGER NOT NULL DEFAULT 1,
    "availableCopies" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_transactions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "studentId" TEXT,
    "employeeId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "issuedByUserId" TEXT NOT NULL,
    "returnedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_reservations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "studentId" TEXT,
    "employeeId" TEXT,
    "status" "LibraryReservationStatus" NOT NULL DEFAULT 'PENDING',
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMP(3),

    CONSTRAINT "library_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_fines" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "transactionId" TEXT,
    "studentId" TEXT,
    "employeeId" TEXT,
    "reason" "LibraryFineReason" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "LibraryFineStatus" NOT NULL DEFAULT 'PENDING',
    "invoiceId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_fines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "loanPeriodDays" INTEGER NOT NULL DEFAULT 14,
    "finePerDayRate" DECIMAL(12,2) NOT NULL DEFAULT 5,
    "maxActiveLoans" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "book_categories_organizationId_idx" ON "book_categories"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "book_categories_organizationId_code_key" ON "book_categories"("organizationId", "code");

-- CreateIndex
CREATE INDEX "books_organizationId_idx" ON "books"("organizationId");

-- CreateIndex
CREATE INDEX "library_transactions_organizationId_idx" ON "library_transactions"("organizationId");

-- CreateIndex
CREATE INDEX "library_transactions_bookId_idx" ON "library_transactions"("bookId");

-- CreateIndex
CREATE INDEX "library_reservations_organizationId_idx" ON "library_reservations"("organizationId");

-- CreateIndex
CREATE INDEX "library_reservations_bookId_idx" ON "library_reservations"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "library_fines_transactionId_key" ON "library_fines"("transactionId");

-- CreateIndex
CREATE INDEX "library_fines_organizationId_idx" ON "library_fines"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "library_settings_organizationId_key" ON "library_settings"("organizationId");

-- AddForeignKey
ALTER TABLE "book_categories" ADD CONSTRAINT "book_categories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "book_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_transactions" ADD CONSTRAINT "library_transactions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_transactions" ADD CONSTRAINT "library_transactions_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_transactions" ADD CONSTRAINT "library_transactions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_transactions" ADD CONSTRAINT "library_transactions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_reservations" ADD CONSTRAINT "library_reservations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_reservations" ADD CONSTRAINT "library_reservations_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_reservations" ADD CONSTRAINT "library_reservations_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_reservations" ADD CONSTRAINT "library_reservations_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_fines" ADD CONSTRAINT "library_fines_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_fines" ADD CONSTRAINT "library_fines_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "library_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_fines" ADD CONSTRAINT "library_fines_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_fines" ADD CONSTRAINT "library_fines_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_fines" ADD CONSTRAINT "library_fines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_settings" ADD CONSTRAINT "library_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Borrower is exactly one of (studentId, employeeId), never both/neither —
-- application-level DTO validation is the primary guard, this CHECK is
-- defense-in-depth at the DB level, same comfort with hand-written SQL
-- this project already has for RLS policies.
ALTER TABLE "library_transactions" ADD CONSTRAINT "library_transactions_borrower_check" CHECK (("studentId" IS NOT NULL) <> ("employeeId" IS NOT NULL));

ALTER TABLE "library_reservations" ADD CONSTRAINT "library_reservations_borrower_check" CHECK (("studentId" IS NOT NULL) <> ("employeeId" IS NOT NULL));

-- library_fines' borrower pair may both be null only when the fine's own
-- transaction already identifies the borrower indirectly is NOT the
-- case here (fines can be created standalone, e.g. a lost/damaged book
-- reported after the fact) — so this check mirrors the other two exactly:
-- exactly one of studentId/employeeId must be set.
ALTER TABLE "library_fines" ADD CONSTRAINT "library_fines_borrower_check" CHECK (("studentId" IS NOT NULL) <> ("employeeId" IS NOT NULL));
