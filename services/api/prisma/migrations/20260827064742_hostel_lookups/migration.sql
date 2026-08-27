-- CreateEnum
CREATE TYPE "HostelLookupKind" AS ENUM ('ROOM_TYPE', 'VISITOR_RELATION', 'COMPLAINT_CATEGORY');

-- CreateTable
CREATE TABLE "hostel_lookups" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "HostelLookupKind" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hostel_lookups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hostel_lookups_organizationId_idx" ON "hostel_lookups"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "hostel_lookups_organizationId_kind_name_key" ON "hostel_lookups"("organizationId", "kind", "name");

-- AddForeignKey
ALTER TABLE "hostel_lookups" ADD CONSTRAINT "hostel_lookups_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
