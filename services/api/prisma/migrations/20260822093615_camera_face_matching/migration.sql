-- CreateEnum
CREATE TYPE "CameraAdapterType" AS ENUM ('SIMULATED', 'RTSP', 'USB_WEBCAM');

-- CreateEnum
CREATE TYPE "CameraStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "FaceMatchResult" AS ENUM ('IDENTIFIED', 'POSSIBLE_MATCH', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "FaceMatchReviewDecision" AS ENUM ('CONFIRMED', 'REJECTED');

-- CreateTable
CREATE TABLE "cameras" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "adapterType" "CameraAdapterType" NOT NULL DEFAULT 'SIMULATED',
    "status" "CameraStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cameras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camera_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cameraId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capturedImage" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "camera_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "face_embeddings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "faceEnrollmentId" TEXT NOT NULL,
    "embedding" vector(512) NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "face_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "face_match_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cameraEventId" TEXT NOT NULL,
    "matchedEnrollmentId" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "result" "FaceMatchResult" NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewDecision" "FaceMatchReviewDecision",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "face_match_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cameras_organizationId_idx" ON "cameras"("organizationId");

-- CreateIndex
CREATE INDEX "camera_events_organizationId_idx" ON "camera_events"("organizationId");

-- CreateIndex
CREATE INDEX "camera_events_cameraId_idx" ON "camera_events"("cameraId");

-- CreateIndex
CREATE UNIQUE INDEX "face_embeddings_faceEnrollmentId_key" ON "face_embeddings"("faceEnrollmentId");

-- CreateIndex
CREATE INDEX "face_embeddings_organizationId_idx" ON "face_embeddings"("organizationId");

-- CreateIndex
CREATE INDEX "face_match_events_organizationId_idx" ON "face_match_events"("organizationId");

-- CreateIndex
CREATE INDEX "face_match_events_cameraEventId_idx" ON "face_match_events"("cameraEventId");

-- AddForeignKey
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camera_events" ADD CONSTRAINT "camera_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camera_events" ADD CONSTRAINT "camera_events_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "cameras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_embeddings" ADD CONSTRAINT "face_embeddings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_embeddings" ADD CONSTRAINT "face_embeddings_faceEnrollmentId_fkey" FOREIGN KEY ("faceEnrollmentId") REFERENCES "face_enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_match_events" ADD CONSTRAINT "face_match_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_match_events" ADD CONSTRAINT "face_match_events_cameraEventId_fkey" FOREIGN KEY ("cameraEventId") REFERENCES "camera_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_match_events" ADD CONSTRAINT "face_match_events_matchedEnrollmentId_fkey" FOREIGN KEY ("matchedEnrollmentId") REFERENCES "face_enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_match_events" ADD CONSTRAINT "face_match_events_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
