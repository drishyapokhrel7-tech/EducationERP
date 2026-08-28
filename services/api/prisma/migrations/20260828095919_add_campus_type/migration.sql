-- CreateEnum
CREATE TYPE "CampusType" AS ENUM ('GENERIC', 'SCHOOL', 'COLLEGE', 'MONTESSORI');

-- AlterTable
ALTER TABLE "campuses" ADD COLUMN     "type" "CampusType" NOT NULL DEFAULT 'GENERIC';
