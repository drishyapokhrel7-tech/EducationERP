-- AlterTable
ALTER TABLE "face_match_events" ADD COLUMN     "reconciledStaffAttendanceId" TEXT,
ADD COLUMN     "reconciledStudentAttendanceId" TEXT;

-- AddForeignKey
ALTER TABLE "face_match_events" ADD CONSTRAINT "face_match_events_reconciledStudentAttendanceId_fkey" FOREIGN KEY ("reconciledStudentAttendanceId") REFERENCES "student_attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_match_events" ADD CONSTRAINT "face_match_events_reconciledStaffAttendanceId_fkey" FOREIGN KEY ("reconciledStaffAttendanceId") REFERENCES "staff_attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
