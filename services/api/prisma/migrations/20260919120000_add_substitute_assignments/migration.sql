-- CreateTable
CREATE TABLE "substitute_assignments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "classScheduleId" TEXT NOT NULL,
    "substituteEmployeeId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "substitute_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "substitute_assignments_organizationId_idx" ON "substitute_assignments"("organizationId");

-- CreateIndex
CREATE INDEX "substitute_assignments_date_idx" ON "substitute_assignments"("date");

-- CreateIndex
CREATE UNIQUE INDEX "substitute_assignments_classScheduleId_date_key" ON "substitute_assignments"("classScheduleId", "date");

-- AddForeignKey
ALTER TABLE "substitute_assignments" ADD CONSTRAINT "substitute_assignments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "substitute_assignments" ADD CONSTRAINT "substitute_assignments_classScheduleId_fkey" FOREIGN KEY ("classScheduleId") REFERENCES "class_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "substitute_assignments" ADD CONSTRAINT "substitute_assignments_substituteEmployeeId_fkey" FOREIGN KEY ("substituteEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

