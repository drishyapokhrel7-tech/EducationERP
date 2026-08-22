import { Injectable, Logger } from "@nestjs/common";
import { FaceEnrollment, Prisma, PrismaClient } from "@prisma/client";

const P2002_UNIQUE_CONSTRAINT = "P2002";

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === P2002_UNIQUE_CONSTRAINT;
}

// UTC throughout, deliberately — this project has no timezone handling
// anywhere yet (Period.startTime/endTime are plain "HH:mm" strings with
// no implied zone), so the self-consistent choice is to anchor
// everything to the DateTime value itself (stored in UTC by Postgres)
// rather than the server process's local TZ, which could differ across
// dev/CI/production for no reason tied to the data. Using UTC here also
// keeps a reconciled session's `date` bit-identical to how a plain
// "YYYY-MM-DD" string from a manual admin action parses elsewhere in
// this codebase (`new Date("2026-08-22")` is UTC midnight) — using
// local components here would risk two different Date values for what
// should be the same day, silently creating a duplicate
// AttendanceSession instead of finding the existing one.
function isoWeekday(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

function toHms(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export interface ReconciliationResult {
  studentAttendanceId?: string;
  staffAttendanceId?: string;
}

/**
 * Wires a confirmed biometric identification (Phase 6 slice 6c) into the
 * existing attendance system (slice 3b) — the "Attendance Event → ERP"
 * step of the architecture doc's CCTV flow diagram. Only ever called for
 * an IDENTIFIED match, or a POSSIBLE_MATCH once a human has CONFIRMED it.
 *
 * "Augments, never replaces": every write here is create-only, guarded
 * by an existence check first — an already-marked session/day is left
 * untouched, never overwritten. This deliberately does not reuse
 * AttendanceService's markAttendance/markStaffAttendance, since both of
 * those unconditionally upsert (overwrite), which is exactly the
 * "replaces" behavior the architecture doc rules out.
 */
@Injectable()
export class AttendanceReconciliationService {
  private readonly logger = new Logger(AttendanceReconciliationService.name);

  async reconcile(
    tx: PrismaClient,
    organizationId: string,
    capturedAt: Date,
    enrollment: FaceEnrollment,
  ): Promise<ReconciliationResult> {
    if (enrollment.studentId) {
      const studentAttendanceId = await this.reconcileStudent(tx, organizationId, capturedAt, enrollment.studentId);
      return studentAttendanceId ? { studentAttendanceId } : {};
    }
    if (enrollment.staffId) {
      const staffAttendanceId = await this.reconcileStaff(tx, organizationId, capturedAt, enrollment.staffId);
      return staffAttendanceId ? { staffAttendanceId } : {};
    }
    return {};
  }

  private async reconcileStudent(
    tx: PrismaClient,
    organizationId: string,
    capturedAt: Date,
    studentId: string,
  ): Promise<string | undefined> {
    const enrollment = await tx.studentEnrollment.findFirst({
      where: {
        organizationId,
        studentId,
        status: "ACTIVE",
        term: { startDate: { lte: capturedAt }, endDate: { gte: capturedAt } },
      },
    });
    if (!enrollment) return undefined;

    const dayOfWeek = isoWeekday(capturedAt);
    const time = toHms(capturedAt);
    const candidates = await tx.classSchedule.findMany({
      where: { organizationId, sectionId: enrollment.sectionId, termId: enrollment.termId, dayOfWeek },
      include: { period: true },
    });
    const classSchedule = candidates.find((c) => c.period.startTime <= time && time <= c.period.endTime);
    if (!classSchedule) return undefined;

    const date = startOfDay(capturedAt);
    let session = await tx.attendanceSession.findFirst({
      where: { organizationId, classScheduleId: classSchedule.id, date },
    });
    if (!session) {
      try {
        session = await tx.attendanceSession.create({
          data: { organizationId, classScheduleId: classSchedule.id, sectionId: classSchedule.sectionId, date },
        });
      } catch (err) {
        if (!isUniqueConstraintError(err)) throw err;
        session = await tx.attendanceSession.findFirst({
          where: { organizationId, classScheduleId: classSchedule.id, date },
        });
        if (!session) throw err;
      }
    }

    const existing = await tx.studentAttendance.findUnique({
      where: { attendanceSessionId_studentId: { attendanceSessionId: session.id, studentId } },
    });
    if (existing) return undefined;

    try {
      const created = await tx.studentAttendance.create({
        data: {
          organizationId,
          attendanceSessionId: session.id,
          studentId,
          status: "PRESENT",
          remarks: "Auto-marked via biometric identification",
        },
      });
      return created.id;
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;
      this.logger.debug("Lost a race marking student attendance; another capture already handled it.");
      return undefined;
    }
  }

  private async reconcileStaff(
    tx: PrismaClient,
    organizationId: string,
    capturedAt: Date,
    employeeId: string,
  ): Promise<string | undefined> {
    const date = startOfDay(capturedAt);
    const existing = await tx.staffAttendance.findUnique({ where: { employeeId_date: { employeeId, date } } });
    if (existing) return undefined;

    try {
      const created = await tx.staffAttendance.create({
        data: {
          organizationId,
          employeeId,
          date,
          status: "PRESENT",
          remarks: "Auto-marked via biometric identification",
        },
      });
      return created.id;
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;
      this.logger.debug("Lost a race marking staff attendance; another capture already handled it.");
      return undefined;
    }
  }
}
