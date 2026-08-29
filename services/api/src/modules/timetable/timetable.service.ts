import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateRoomDto } from "./dto/create-room.dto";
import { UpdateRoomDto } from "./dto/update-room.dto";
import { CreatePeriodDto } from "./dto/create-period.dto";
import { UpdatePeriodDto } from "./dto/update-period.dto";
import { CreateTeachingAssignmentDto } from "./dto/create-teaching-assignment.dto";
import { UpdateTeachingAssignmentDto } from "./dto/update-teaching-assignment.dto";
import { CreateClassScheduleDto } from "./dto/create-class-schedule.dto";
import { UpdateClassScheduleDto } from "./dto/update-class-schedule.dto";
import { assertNoDependents } from "../../common/assert-no-dependents";

/**
 * Same FK-vs-RLS parent-guard pattern as every prior slice's service.
 * ClassSchedule additionally denormalizes sectionId/teacherId off its
 * teachingAssignment so Postgres's own unique constraints (see the
 * schema comment on ClassSchedule) can enforce "no double-booking" —
 * this service pre-checks those same three dimensions before insert so
 * a conflict comes back as a specific 409 message, not a raw constraint
 * violation.
 */
@Injectable()
export class TimetableService {
  constructor(private readonly prisma: PrismaService) {}

  listRooms(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.room.findMany({ where: { organizationId, deletedAt: null } }),
    );
  }

  async createRoom(organizationId: string, dto: CreateRoomDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const campus = await tx.campus.findUnique({ where: { id: dto.campusId } });
      if (!campus) throw new NotFoundException("Campus not found");
      return tx.room.create({
        data: {
          organizationId,
          campusId: dto.campusId,
          name: dto.name,
          code: dto.code,
          capacity: dto.capacity,
          roomType: dto.roomType,
        },
      });
    });
  }

  async updateRoom(organizationId: string, id: string, dto: UpdateRoomDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadRoom(tx, organizationId, id);
      if (dto.campusId) {
        const campus = await tx.campus.findUnique({ where: { id: dto.campusId } });
        if (!campus) throw new NotFoundException("Campus not found");
      }
      return tx.room.update({ where: { id }, data: dto });
    });
  }

  // Hard-delete, guarded — Room does have a deletedAt column (used
  // elsewhere for soft-archival), but this endpoint intentionally does
  // not touch it: a real delete here is only permitted once nothing
  // still references the room.
  async deleteRoom(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadRoom(tx, organizationId, id);
      await assertNoDependents(
        [
          tx.examRoom.count({ where: { roomId: id } }),
          tx.classSchedule.count({ where: { roomId: id } }),
        ],
        "room",
      );
      await tx.room.delete({ where: { id } });
      return { deleted: true };
    });
  }

  private async loadRoom(tx: PrismaClient, organizationId: string, id: string) {
    const room = await tx.room.findUnique({ where: { id } });
    if (!room || room.organizationId !== organizationId || room.deletedAt) throw new NotFoundException("Room not found");
    return room;
  }

  listPeriods(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.period.findMany({ where: { organizationId }, orderBy: { sequence: "asc" } }),
    );
  }

  createPeriod(organizationId: string, dto: CreatePeriodDto) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.period.create({
        data: {
          organizationId,
          name: dto.name,
          code: dto.code,
          sequence: dto.sequence,
          startTime: dto.startTime,
          endTime: dto.endTime,
        },
      }),
    );
  }

  async updatePeriod(organizationId: string, id: string, dto: UpdatePeriodDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadPeriod(tx, organizationId, id);
      return tx.period.update({ where: { id }, data: dto });
    });
  }

  async deletePeriod(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadPeriod(tx, organizationId, id);
      await assertNoDependents([tx.classSchedule.count({ where: { periodId: id } })], "period");
      await tx.period.delete({ where: { id } });
      return { deleted: true };
    });
  }

  private async loadPeriod(tx: PrismaClient, organizationId: string, id: string) {
    const period = await tx.period.findUnique({ where: { id } });
    if (!period || period.organizationId !== organizationId) throw new NotFoundException("Period not found");
    return period;
  }

  listTeachingAssignments(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.teachingAssignment.findMany({
        where: { organizationId },
        include: { employee: true, subject: true, section: true, term: true },
        orderBy: [{ employee: { firstName: "asc" } }, { employee: { lastName: "asc" } }],
      }),
    );
  }

  async createTeachingAssignment(organizationId: string, dto: CreateTeachingAssignmentDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const [employee, subject, section, term] = await Promise.all([
        tx.employee.findUnique({ where: { id: dto.employeeId } }),
        tx.subject.findUnique({ where: { id: dto.subjectId } }),
        tx.section.findUnique({ where: { id: dto.sectionId } }),
        tx.term.findUnique({ where: { id: dto.termId } }),
      ]);
      if (!employee) throw new NotFoundException("Employee not found");
      if (!subject) throw new NotFoundException("Subject not found");
      if (!section) throw new NotFoundException("Section not found");
      if (!term) throw new NotFoundException("Term not found");

      const existing = await tx.teachingAssignment.findUnique({
        where: {
          sectionId_subjectId_termId: {
            sectionId: dto.sectionId,
            subjectId: dto.subjectId,
            termId: dto.termId,
          },
        },
      });
      if (existing) {
        throw new ConflictException(
          "This section already has a teacher assigned for this subject and term",
        );
      }

      return tx.teachingAssignment.create({
        data: {
          organizationId,
          employeeId: dto.employeeId,
          subjectId: dto.subjectId,
          sectionId: dto.sectionId,
          termId: dto.termId,
        },
      });
    });
  }

  private async loadTeachingAssignment(tx: PrismaClient, organizationId: string, id: string) {
    const assignment = await tx.teachingAssignment.findUnique({ where: { id } });
    if (!assignment || assignment.organizationId !== organizationId) throw new NotFoundException("Teaching assignment not found");
    return assignment;
  }

  async updateTeachingAssignment(organizationId: string, id: string, dto: UpdateTeachingAssignmentDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const current = await this.loadTeachingAssignment(tx, organizationId, id);
      const [employee, subject, section, term] = await Promise.all([
        dto.employeeId ? tx.employee.findUnique({ where: { id: dto.employeeId } }) : null,
        dto.subjectId ? tx.subject.findUnique({ where: { id: dto.subjectId } }) : null,
        dto.sectionId ? tx.section.findUnique({ where: { id: dto.sectionId } }) : null,
        dto.termId ? tx.term.findUnique({ where: { id: dto.termId } }) : null,
      ]);
      if (dto.employeeId && !employee) throw new NotFoundException("Employee not found");
      if (dto.subjectId && !subject) throw new NotFoundException("Subject not found");
      if (dto.sectionId && !section) throw new NotFoundException("Section not found");
      if (dto.termId && !term) throw new NotFoundException("Term not found");

      const sectionId = dto.sectionId ?? current.sectionId;
      const subjectId = dto.subjectId ?? current.subjectId;
      const termId = dto.termId ?? current.termId;
      if (sectionId !== current.sectionId || subjectId !== current.subjectId || termId !== current.termId) {
        const conflict = await tx.teachingAssignment.findUnique({
          where: { sectionId_subjectId_termId: { sectionId, subjectId, termId } },
        });
        if (conflict && conflict.id !== id) {
          throw new ConflictException("This section already has a teacher assigned for this subject and term");
        }
      }

      return tx.teachingAssignment.update({
        where: { id },
        data: { employeeId: dto.employeeId, subjectId: dto.subjectId, sectionId: dto.sectionId, termId: dto.termId },
        include: { employee: true, subject: true, section: true, term: true },
      });
    });
  }

  // A teaching assignment sits under a lot of real content once a term
  // is underway (lesson plans, assignments, knowledge checks, course
  // modules, announcements, discussion topics), on top of the class
  // schedule entries built from it — every one of those gets checked,
  // not just the schedule.
  async deleteTeachingAssignment(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadTeachingAssignment(tx, organizationId, id);
      await assertNoDependents(
        [
          tx.classSchedule.count({ where: { teachingAssignmentId: id } }),
          tx.lessonPlan.count({ where: { teachingAssignmentId: id } }),
          tx.assignment.count({ where: { teachingAssignmentId: id } }),
          tx.knowledgeCheck.count({ where: { teachingAssignmentId: id } }),
          tx.courseModule.count({ where: { teachingAssignmentId: id } }),
          tx.announcement.count({ where: { teachingAssignmentId: id } }),
          tx.discussionTopic.count({ where: { teachingAssignmentId: id } }),
        ],
        "teaching assignment",
      );
      await tx.teachingAssignment.delete({ where: { id } });
      return { deleted: true };
    });
  }

  listClassSchedules(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.classSchedule.findMany({
        where: { organizationId },
        include: {
          room: true,
          period: true,
          section: true,
          teacher: true,
          teachingAssignment: { include: { subject: true } },
        },
        orderBy: [{ dayOfWeek: "asc" }, { period: { sequence: "asc" } }],
      }),
    );
  }

  async createClassSchedule(organizationId: string, dto: CreateClassScheduleDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const [teachingAssignment, room, period] = await Promise.all([
        tx.teachingAssignment.findUnique({ where: { id: dto.teachingAssignmentId } }),
        tx.room.findUnique({ where: { id: dto.roomId } }),
        tx.period.findUnique({ where: { id: dto.periodId } }),
      ]);
      if (!teachingAssignment) throw new NotFoundException("Teaching assignment not found");
      if (!room) throw new NotFoundException("Room not found");
      if (!period) throw new NotFoundException("Period not found");

      const { termId, sectionId, employeeId: teacherId } = teachingAssignment;

      const [roomConflict, sectionConflict, teacherConflict] = await Promise.all([
        tx.classSchedule.findFirst({
          where: { termId, roomId: dto.roomId, dayOfWeek: dto.dayOfWeek, periodId: dto.periodId },
        }),
        tx.classSchedule.findFirst({
          where: { termId, sectionId, dayOfWeek: dto.dayOfWeek, periodId: dto.periodId },
        }),
        tx.classSchedule.findFirst({
          where: { termId, teacherId, dayOfWeek: dto.dayOfWeek, periodId: dto.periodId },
        }),
      ]);
      if (roomConflict) throw new ConflictException("Room is already booked for this day and period");
      if (sectionConflict) throw new ConflictException("Section already has a class in this day and period");
      if (teacherConflict) throw new ConflictException("Teacher is already teaching another class in this day and period");

      return tx.classSchedule.create({
        data: {
          organizationId,
          termId,
          teachingAssignmentId: dto.teachingAssignmentId,
          sectionId,
          teacherId,
          roomId: dto.roomId,
          periodId: dto.periodId,
          dayOfWeek: dto.dayOfWeek,
        },
      });
    });
  }

  private async loadClassSchedule(tx: PrismaClient, organizationId: string, id: string) {
    const schedule = await tx.classSchedule.findUnique({ where: { id } });
    if (!schedule || schedule.organizationId !== organizationId) throw new NotFoundException("Schedule entry not found");
    return schedule;
  }

  // Re-derives termId/sectionId/teacherId from the (possibly new)
  // teaching assignment, same as createClassSchedule, and re-runs the
  // identical three double-booking checks — excluding this row's own
  // id, since updating a schedule entry in place isn't a conflict
  // with itself.
  async updateClassSchedule(organizationId: string, id: string, dto: UpdateClassScheduleDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const current = await this.loadClassSchedule(tx, organizationId, id);

      const [teachingAssignment, room, period] = await Promise.all([
        dto.teachingAssignmentId
          ? tx.teachingAssignment.findUnique({ where: { id: dto.teachingAssignmentId } })
          : tx.teachingAssignment.findUnique({ where: { id: current.teachingAssignmentId } }),
        dto.roomId ? tx.room.findUnique({ where: { id: dto.roomId } }) : null,
        dto.periodId ? tx.period.findUnique({ where: { id: dto.periodId } }) : null,
      ]);
      if (!teachingAssignment) throw new NotFoundException("Teaching assignment not found");
      if (dto.roomId && !room) throw new NotFoundException("Room not found");
      if (dto.periodId && !period) throw new NotFoundException("Period not found");

      const { termId, sectionId, employeeId: teacherId } = teachingAssignment;
      const roomId = dto.roomId ?? current.roomId;
      const periodId = dto.periodId ?? current.periodId;
      const dayOfWeek = dto.dayOfWeek ?? current.dayOfWeek;

      const [roomConflict, sectionConflict, teacherConflict] = await Promise.all([
        tx.classSchedule.findFirst({ where: { termId, roomId, dayOfWeek, periodId } }),
        tx.classSchedule.findFirst({ where: { termId, sectionId, dayOfWeek, periodId } }),
        tx.classSchedule.findFirst({ where: { termId, teacherId, dayOfWeek, periodId } }),
      ]);
      if (roomConflict && roomConflict.id !== id) throw new ConflictException("Room is already booked for this day and period");
      if (sectionConflict && sectionConflict.id !== id) {
        throw new ConflictException("Section already has a class in this day and period");
      }
      if (teacherConflict && teacherConflict.id !== id) {
        throw new ConflictException("Teacher is already teaching another class in this day and period");
      }

      return tx.classSchedule.update({
        where: { id },
        data: {
          termId,
          teachingAssignmentId: dto.teachingAssignmentId,
          sectionId,
          teacherId,
          roomId: dto.roomId,
          periodId: dto.periodId,
          dayOfWeek: dto.dayOfWeek,
        },
        include: { room: true, period: true, section: true, teacher: true, teachingAssignment: { include: { subject: true } } },
      });
    });
  }

  async deleteClassSchedule(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadClassSchedule(tx, organizationId, id);
      await assertNoDependents(
        [
          tx.attendanceSession.count({ where: { classScheduleId: id } }),
          tx.classSession.count({ where: { classScheduleId: id } }),
        ],
        "schedule entry",
      );
      await tx.classSchedule.delete({ where: { id } });
      return { deleted: true };
    });
  }
}
