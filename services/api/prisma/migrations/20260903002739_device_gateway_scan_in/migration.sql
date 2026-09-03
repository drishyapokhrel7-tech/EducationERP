-- CreateEnum
CREATE TYPE "GatewayDeviceType" AS ENUM ('BARCODE_SCANNER', 'RFID_READER', 'SMART_CARD_READER', 'FINGERPRINT_SCANNER', 'PRINTER');

-- CreateEnum
CREATE TYPE "GatewayScanResult" AS ENUM ('IDENTIFIED', 'NOT_FOUND');

-- CreateTable
CREATE TABLE "gateway_devices" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deviceType" "GatewayDeviceType" NOT NULL,
    "location" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gateway_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateway_card_bindings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "rawCode" TEXT NOT NULL,
    "studentId" TEXT,
    "staffId" TEXT,
    "boundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "boundBy" TEXT NOT NULL,

    CONSTRAINT "gateway_card_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateway_scan_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "rawCode" TEXT NOT NULL,
    "matchedStudentId" TEXT,
    "matchedEmployeeId" TEXT,
    "result" "GatewayScanResult" NOT NULL,
    "reconciledStudentAttendanceId" TEXT,
    "reconciledStaffAttendanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gateway_scan_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gateway_devices_organizationId_idx" ON "gateway_devices"("organizationId");

-- CreateIndex
CREATE INDEX "gateway_card_bindings_organizationId_idx" ON "gateway_card_bindings"("organizationId");

-- CreateIndex
CREATE INDEX "gateway_card_bindings_studentId_idx" ON "gateway_card_bindings"("studentId");

-- CreateIndex
CREATE INDEX "gateway_card_bindings_staffId_idx" ON "gateway_card_bindings"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "gateway_card_bindings_organizationId_rawCode_key" ON "gateway_card_bindings"("organizationId", "rawCode");

-- CreateIndex
CREATE INDEX "gateway_scan_events_organizationId_idx" ON "gateway_scan_events"("organizationId");

-- CreateIndex
CREATE INDEX "gateway_scan_events_deviceId_idx" ON "gateway_scan_events"("deviceId");

-- AddForeignKey
ALTER TABLE "gateway_devices" ADD CONSTRAINT "gateway_devices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway_card_bindings" ADD CONSTRAINT "gateway_card_bindings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway_card_bindings" ADD CONSTRAINT "gateway_card_bindings_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway_card_bindings" ADD CONSTRAINT "gateway_card_bindings_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway_card_bindings" ADD CONSTRAINT "gateway_card_bindings_boundBy_fkey" FOREIGN KEY ("boundBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway_scan_events" ADD CONSTRAINT "gateway_scan_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway_scan_events" ADD CONSTRAINT "gateway_scan_events_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "gateway_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway_scan_events" ADD CONSTRAINT "gateway_scan_events_matchedStudentId_fkey" FOREIGN KEY ("matchedStudentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway_scan_events" ADD CONSTRAINT "gateway_scan_events_matchedEmployeeId_fkey" FOREIGN KEY ("matchedEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway_scan_events" ADD CONSTRAINT "gateway_scan_events_reconciledStudentAttendanceId_fkey" FOREIGN KEY ("reconciledStudentAttendanceId") REFERENCES "student_attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway_scan_events" ADD CONSTRAINT "gateway_scan_events_reconciledStaffAttendanceId_fkey" FOREIGN KEY ("reconciledStaffAttendanceId") REFERENCES "staff_attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
