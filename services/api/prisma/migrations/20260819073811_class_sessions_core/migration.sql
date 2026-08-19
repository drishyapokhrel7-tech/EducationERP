-- CreateEnum
CREATE TYPE "ClassSessionStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "class_sessions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "classScheduleId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "lessonPlanId" TEXT,
    "actualSyllabusNodeId" TEXT,
    "progressNotes" TEXT,
    "status" "ClassSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_materials" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "classSessionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_materials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "class_sessions_organizationId_idx" ON "class_sessions"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "class_sessions_classScheduleId_date_key" ON "class_sessions"("classScheduleId", "date");

-- CreateIndex
CREATE INDEX "class_materials_organizationId_idx" ON "class_materials"("organizationId");

-- CreateIndex
CREATE INDEX "class_materials_classSessionId_idx" ON "class_materials"("classSessionId");

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_classScheduleId_fkey" FOREIGN KEY ("classScheduleId") REFERENCES "class_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_lessonPlanId_fkey" FOREIGN KEY ("lessonPlanId") REFERENCES "lesson_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_actualSyllabusNodeId_fkey" FOREIGN KEY ("actualSyllabusNodeId") REFERENCES "syllabus_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_materials" ADD CONSTRAINT "class_materials_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_materials" ADD CONSTRAINT "class_materials_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "class_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
