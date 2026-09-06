import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateAttendanceSessionDto } from "./dto/create-attendance-session.dto";
import { MarkAttendanceDto } from "./dto/mark-attendance.dto";
import { CorrectAttendanceDto } from "./dto/correct-attendance.dto";
import { CreateStaffAttendanceDto } from "./dto/create-staff-attendance.dto";

/**
 * Same FK-vs-RLS parent-guard pattern as every prior slice's service.
 * A session's "roster" (which students can be marked) is always computed
 * fresh from active StudentEnrollment rows for the session's section,
 * never trusted from client input — this is what markAttendance validates
 * every entry against, so attendance can't be recorded for a student who
 * isn't actually enrolled in that class.
 */
@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  listSessions(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.attendanceSession.findMany({
        where: { organizationId },
        include: {
          section: true,
          classSchedule: { include: { period: true, room: true, teachingAssignment: { include: { subject: true } } } },
          studentAttendance: { include: { student: true } },
        },
        orderBy: { date: "desc" },
      }),
    );
  }

  async createSession(organizationId: string, dto: CreateAttendanceSessionDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const classSchedule = await tx.classSchedule.findUnique({
        where: { id: dto.classScheduleId },
        include: { teachingAssignment: true },
      });
      if (!classSchedule) throw new NotFoundException("Class schedule not found");

      const existing = await tx.attendanceSession.findFirst({
        where: { organizationId, classScheduleId: dto.classScheduleId, date: new Date(dto.date) },
      });
      if (existing) {
        throw new ConflictException("A session for this schedule and date already exists");
      }

      const session = await tx.attendanceSession.create({
        data: {
          organizationId,
          classScheduleId: dto.classScheduleId,
          sectionId: classSchedule.sectionId,
          date: new Date(dto.date),
        },
        include: { section: true },
      });
      // Scoped by programId + semesterId, not sectionId alone —
      // sectionId is optional, and without programId two different
      // section-less programs running in the same semester would
      // otherwise look like one merged cohort here.
      const roster = await tx.studentEnrollment.findMany({
        where: {
          organizationId,
          programId: classSchedule.teachingAssignment.programId,
          semesterId: classSchedule.semesterId,
          sectionId: classSchedule.sectionId,
          status: "ACTIVE",
        },
        include: { student: true },
      });
      // A freshly-created session has no marks yet — studentAttendance is
      // always [] here, unlike getSession's response for an existing one.
      return { ...session, studentAttendance: [], roster: roster.map((e) => e.student) };
    });
  }

  async getSession(organizationId: string, sessionId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const session = await tx.attendanceSession.findUnique({
        where: { id: sessionId },
        include: {
          section: true,
          studentAttendance: { include: { student: true } },
          classSchedule: { include: { teachingAssignment: true } },
        },
      });
      if (!session) throw new NotFoundException("Attendance session not found");
      // Same programId + semesterId + sectionId scoping as createSession.
      const roster = await tx.studentEnrollment.findMany({
        where: {
          organizationId,
          programId: session.classSchedule.teachingAssignment.programId,
          semesterId: session.classSchedule.semesterId,
          sectionId: session.sectionId,
          status: "ACTIVE",
        },
        include: { student: true },
      });
      return { ...session, roster: roster.map((e) => e.student) };
    });
  }

  async markAttendance(organizationId: string, sessionId: string, dto: MarkAttendanceDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const session = await tx.attendanceSession.findUnique({
        where: { id: sessionId },
        include: { classSchedule: { include: { teachingAssignment: true } } },
      });
      if (!session) throw new NotFoundException("Attendance session not found");

      // Same programId + semesterId + sectionId scoping as
      // createSession/getSession's own roster queries.
      const roster = await tx.studentEnrollment.findMany({
        where: {
          organizationId,
          programId: session.classSchedule.teachingAssignment.programId,
          semesterId: session.classSchedule.semesterId,
          sectionId: session.sectionId,
          status: "ACTIVE",
        },
      });
      const rosterIds = new Set(roster.map((e) => e.studentId));
      const invalid = dto.entries.filter((e) => !rosterIds.has(e.studentId));
      if (invalid.length > 0) {
        throw new BadRequestException(
          `Not enrolled in this section: ${invalid.map((e) => e.studentId).join(", ")}`,
        );
      }

      for (const entry of dto.entries) {
        await tx.studentAttendance.upsert({
          where: { attendanceSessionId_studentId: { attendanceSessionId: sessionId, studentId: entry.studentId } },
          update: { status: entry.status, remarks: entry.remarks },
          create: {
            organizationId,
            attendanceSessionId: sessionId,
            studentId: entry.studentId,
            status: entry.status,
            remarks: entry.remarks,
          },
        });
      }

      return tx.studentAttendance.findMany({
        where: { organizationId, attendanceSessionId: sessionId },
        include: { student: true },
      });
    });
  }

  async correctAttendance(
    organizationId: string,
    sessionId: string,
    studentId: string,
    dto: CorrectAttendanceDto,
  ) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const existing = await tx.studentAttendance.findUnique({
        where: { attendanceSessionId_studentId: { attendanceSessionId: sessionId, studentId } },
      });
      if (!existing) {
        throw new NotFoundException("No attendance record to correct — mark attendance first");
      }

      await tx.attendanceException.create({
        data: {
          organizationId,
          studentAttendanceId: existing.id,
          previousStatus: existing.status,
          newStatus: dto.status,
          reason: dto.reason,
        },
      });

      return tx.studentAttendance.update({
        where: { id: existing.id },
        data: { status: dto.status },
      });
    });
  }

  listStaffAttendance(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.staffAttendance.findMany({
        where: { organizationId },
        include: { employee: true },
        orderBy: { date: "desc" },
      }),
    );
  }

  async markStaffAttendance(organizationId: string, dto: CreateStaffAttendanceDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const employee = await tx.employee.findUnique({ where: { id: dto.employeeId } });
      if (!employee) throw new NotFoundException("Employee not found");

      return tx.staffAttendance.upsert({
        where: { employeeId_date: { employeeId: dto.employeeId, date: new Date(dto.date) } },
        update: { status: dto.status, remarks: dto.remarks },
        create: {
          organizationId,
          employeeId: dto.employeeId,
          date: new Date(dto.date),
          status: dto.status,
          remarks: dto.remarks,
        },
      });
    });
  }
}
