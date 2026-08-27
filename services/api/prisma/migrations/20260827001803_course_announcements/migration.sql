-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teachingAssignmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "announcements_organizationId_idx" ON "announcements"("organizationId");

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_teachingAssignmentId_fkey" FOREIGN KEY ("teachingAssignmentId") REFERENCES "teaching_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
