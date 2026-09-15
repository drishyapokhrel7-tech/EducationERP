-- CreateEnum
CREATE TYPE "FaceVerifiedOutcome" AS ENUM ('MATCHED', 'NOT_MATCHED', 'MANUAL_OVERRIDE', 'UNAVAILABLE', 'NOT_ENROLLED');

-- AlterTable
ALTER TABLE "library_transactions" ADD COLUMN     "issueFaceVerified" "FaceVerifiedOutcome";
