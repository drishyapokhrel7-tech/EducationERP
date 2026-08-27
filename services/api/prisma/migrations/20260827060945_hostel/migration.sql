-- CreateEnum
CREATE TYPE "HostelBedStatus" AS ENUM ('AVAILABLE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "HostelAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "HostelComplaintStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "HostelMaintenanceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateTable
CREATE TABLE "hostels" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hostels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostel_buildings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hostelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hostel_buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostel_rooms" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "roomType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hostel_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostel_beds" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "HostelBedStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hostel_beds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostel_allocations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "bedId" TEXT NOT NULL,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hostel_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostel_attendance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hostelAllocationId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "HostelAttendanceStatus" NOT NULL,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hostel_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostel_visitors" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hostelAllocationId" TEXT NOT NULL,
    "visitorName" TEXT NOT NULL,
    "relation" TEXT,
    "checkInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutAt" TIMESTAMP(3),

    CONSTRAINT "hostel_visitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostel_complaints" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hostelAllocationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "HostelComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,

    CONSTRAINT "hostel_complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostel_maintenance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "HostelMaintenanceStatus" NOT NULL DEFAULT 'OPEN',
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "hostel_maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hostels_organizationId_idx" ON "hostels"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "hostels_organizationId_code_key" ON "hostels"("organizationId", "code");

-- CreateIndex
CREATE INDEX "hostel_buildings_organizationId_idx" ON "hostel_buildings"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "hostel_buildings_hostelId_code_key" ON "hostel_buildings"("hostelId", "code");

-- CreateIndex
CREATE INDEX "hostel_rooms_organizationId_idx" ON "hostel_rooms"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "hostel_rooms_buildingId_roomNumber_key" ON "hostel_rooms"("buildingId", "roomNumber");

-- CreateIndex
CREATE INDEX "hostel_beds_organizationId_idx" ON "hostel_beds"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "hostel_beds_roomId_label_key" ON "hostel_beds"("roomId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "hostel_allocations_studentEnrollmentId_key" ON "hostel_allocations"("studentEnrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "hostel_allocations_bedId_key" ON "hostel_allocations"("bedId");

-- CreateIndex
CREATE INDEX "hostel_allocations_organizationId_idx" ON "hostel_allocations"("organizationId");

-- CreateIndex
CREATE INDEX "hostel_attendance_organizationId_idx" ON "hostel_attendance"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "hostel_attendance_hostelAllocationId_date_key" ON "hostel_attendance"("hostelAllocationId", "date");

-- CreateIndex
CREATE INDEX "hostel_visitors_organizationId_idx" ON "hostel_visitors"("organizationId");

-- CreateIndex
CREATE INDEX "hostel_complaints_organizationId_idx" ON "hostel_complaints"("organizationId");

-- CreateIndex
CREATE INDEX "hostel_maintenance_organizationId_idx" ON "hostel_maintenance"("organizationId");

-- AddForeignKey
ALTER TABLE "hostels" ADD CONSTRAINT "hostels_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_buildings" ADD CONSTRAINT "hostel_buildings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_buildings" ADD CONSTRAINT "hostel_buildings_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "hostels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_rooms" ADD CONSTRAINT "hostel_rooms_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_rooms" ADD CONSTRAINT "hostel_rooms_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "hostel_buildings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_beds" ADD CONSTRAINT "hostel_beds_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_beds" ADD CONSTRAINT "hostel_beds_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "hostel_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_allocations" ADD CONSTRAINT "hostel_allocations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_allocations" ADD CONSTRAINT "hostel_allocations_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "student_enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_allocations" ADD CONSTRAINT "hostel_allocations_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "hostel_beds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_attendance" ADD CONSTRAINT "hostel_attendance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_attendance" ADD CONSTRAINT "hostel_attendance_hostelAllocationId_fkey" FOREIGN KEY ("hostelAllocationId") REFERENCES "hostel_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_visitors" ADD CONSTRAINT "hostel_visitors_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_visitors" ADD CONSTRAINT "hostel_visitors_hostelAllocationId_fkey" FOREIGN KEY ("hostelAllocationId") REFERENCES "hostel_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_complaints" ADD CONSTRAINT "hostel_complaints_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_complaints" ADD CONSTRAINT "hostel_complaints_hostelAllocationId_fkey" FOREIGN KEY ("hostelAllocationId") REFERENCES "hostel_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_maintenance" ADD CONSTRAINT "hostel_maintenance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hostel_maintenance" ADD CONSTRAINT "hostel_maintenance_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "hostel_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
