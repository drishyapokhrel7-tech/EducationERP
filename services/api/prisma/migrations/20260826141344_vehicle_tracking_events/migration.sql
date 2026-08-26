-- CreateTable
CREATE TABLE "vehicle_tracking_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "routeId" TEXT,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_tracking_events_organizationId_idx" ON "vehicle_tracking_events"("organizationId");

-- CreateIndex
CREATE INDEX "vehicle_tracking_events_vehicleId_recordedAt_idx" ON "vehicle_tracking_events"("vehicleId", "recordedAt");

-- AddForeignKey
ALTER TABLE "vehicle_tracking_events" ADD CONSTRAINT "vehicle_tracking_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_tracking_events" ADD CONSTRAINT "vehicle_tracking_events_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_tracking_events" ADD CONSTRAINT "vehicle_tracking_events_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
