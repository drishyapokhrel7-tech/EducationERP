-- AlterTable
ALTER TABLE "designations" ADD COLUMN     "staffTypeId" TEXT;

-- CreateIndex
CREATE INDEX "designations_staffTypeId_idx" ON "designations"("staffTypeId");

-- AddForeignKey
ALTER TABLE "designations" ADD CONSTRAINT "designations_staffTypeId_fkey" FOREIGN KEY ("staffTypeId") REFERENCES "staff_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
