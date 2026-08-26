-- CreateEnum
CREATE TYPE "CourseModuleItemType" AS ENUM ('PAGE', 'LINK', 'VIDEO', 'DOCUMENT');

-- CreateTable
CREATE TABLE "course_modules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teachingAssignmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sequence" INTEGER NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_module_items" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "type" "CourseModuleItemType" NOT NULL,
    "content" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_module_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_module_item_completions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "moduleItemId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_module_item_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_modules_organizationId_idx" ON "course_modules"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "course_modules_teachingAssignmentId_sequence_key" ON "course_modules"("teachingAssignmentId", "sequence");

-- CreateIndex
CREATE INDEX "course_module_items_organizationId_idx" ON "course_module_items"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "course_module_items_moduleId_sequence_key" ON "course_module_items"("moduleId", "sequence");

-- CreateIndex
CREATE INDEX "course_module_item_completions_organizationId_idx" ON "course_module_item_completions"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "course_module_item_completions_moduleItemId_studentId_key" ON "course_module_item_completions"("moduleItemId", "studentId");

-- AddForeignKey
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_teachingAssignmentId_fkey" FOREIGN KEY ("teachingAssignmentId") REFERENCES "teaching_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_module_items" ADD CONSTRAINT "course_module_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_module_items" ADD CONSTRAINT "course_module_items_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "course_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_module_item_completions" ADD CONSTRAINT "course_module_item_completions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_module_item_completions" ADD CONSTRAINT "course_module_item_completions_moduleItemId_fkey" FOREIGN KEY ("moduleItemId") REFERENCES "course_module_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_module_item_completions" ADD CONSTRAINT "course_module_item_completions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
