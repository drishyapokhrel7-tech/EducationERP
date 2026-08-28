import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateClassSessionDto } from "./dto/create-class-session.dto";
import { RecordProgressDto } from "./dto/record-progress.dto";
import { CreateClassMaterialDto } from "./dto/create-class-material.dto";

const SESSION_INCLUDE = {
  classSchedule: {
    include: { period: true, room: true, teachingAssignment: { include: { subject: true, employee: true } } },
  },
  section: true,
  lessonPlan: true,
  actualSyllabusNode: true,
  materials: true,
} as const;

// JS Date#getUTCDay is 0=Sunday..6=Saturday; ClassSchedule.dayOfWeek is
// 1=Monday..7=Sunday (ISO 8601, see its schema comment) — this converts
// between the two. Dates arrive as plain "YYYY-MM-DD" strings (no time
// component), so `new Date(dateStr)` is UTC midnight and getUTCDay()
// reflects the intended calendar weekday regardless of server timezone.
function isoDayOfWeek(date: Date): number {
  return ((date.getUTCDay() + 6) % 7) + 1;
}

/** Same FK-vs-RLS parent-guard pattern as every prior slice's service. */
@Injectable()
export class ClassSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  // "My Classes Today": every ClassSchedule slot that recurs on the
  // given date's weekday, each annotated with whether a ClassSession
  // and/or AttendanceSession already exists for that specific date —
  // opening a class is a separate explicit action (createSession), not
  // implied by just viewing this list.
  async myClassesToday(organizationId: string, dateStr: string) {
    const date = new Date(dateStr);
    const dayOfWeek = isoDayOfWeek(date);

    return this.prisma.withTenant(organizationId, async (tx) => {
      const schedules = await tx.classSchedule.findMany({
        where: { organizationId, dayOfWeek },
        include: {
          period: true,
          room: true,
          section: true,
          teachingAssignment: { include: { subject: true, employee: true } },
        },
        orderBy: { period: { sequence: "asc" } },
      });

      const results = [];
      for (const schedule of schedules) {
        const [classSession, attendanceSession] = await Promise.all([
          tx.classSession.findUnique({
            where: { classScheduleId_date: { classScheduleId: schedule.id, date } },
          }),
          tx.attendanceSession.findFirst({
            where: { organizationId, classScheduleId: schedule.id, date },
            include: { studentAttendance: true },
          }),
        ]);
        results.push({
          classSchedule: schedule,
          classSession,
          attendanceMarked: attendanceSession?.studentAttendance.length ?? null,
        });
      }
      return results;
    });
  }

  async createSession(organizationId: string, dto: CreateClassSessionDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const classSchedule = await tx.classSchedule.findUnique({ where: { id: dto.classScheduleId } });
      if (!classSchedule) throw new NotFoundException("Class schedule not found");

      if (dto.lessonPlanId) {
        const lessonPlan = await tx.lessonPlan.findUnique({ where: { id: dto.lessonPlanId } });
        if (!lessonPlan) throw new NotFoundException("Lesson plan not found");
      }

      const date = new Date(dto.date);
      const existing = await tx.classSession.findUnique({
        where: { classScheduleId_date: { classScheduleId: dto.classScheduleId, date } },
      });
      if (existing) {
        throw new ConflictException("A class session for this schedule and date already exists");
      }

      return tx.classSession.create({
        data: {
          organizationId,
          classScheduleId: dto.classScheduleId,
          sectionId: classSchedule.sectionId,
          date,
          lessonPlanId: dto.lessonPlanId,
        },
        include: SESSION_INCLUDE,
      });
    });
  }

  async getSession(organizationId: string, sessionId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const session = await tx.classSession.findUnique({ where: { id: sessionId }, include: SESSION_INCLUDE });
      if (!session) throw new NotFoundException("Class session not found");
      return session;
    });
  }

  async recordProgress(organizationId: string, sessionId: string, dto: RecordProgressDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const session = await tx.classSession.findUnique({ where: { id: sessionId } });
      if (!session) throw new NotFoundException("Class session not found");

      if (dto.actualSyllabusNodeId) {
        const node = await tx.syllabusNode.findUnique({ where: { id: dto.actualSyllabusNodeId } });
        if (!node) throw new NotFoundException("Syllabus node not found");
      }

      return tx.classSession.update({
        where: { id: sessionId },
        data: {
          actualSyllabusNodeId: dto.actualSyllabusNodeId,
          progressNotes: dto.progressNotes,
          // Recording progress is what moves a session past "just
          // scheduled" — only advance forward, never regress a session
          // that's already COMPLETED back to IN_PROGRESS.
          status: session.status === "SCHEDULED" ? "IN_PROGRESS" : session.status,
        },
        include: SESSION_INCLUDE,
      });
    });
  }

  async addMaterial(organizationId: string, sessionId: string, dto: CreateClassMaterialDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const session = await tx.classSession.findUnique({ where: { id: sessionId } });
      if (!session) throw new NotFoundException("Class session not found");

      return tx.classMaterial.create({
        data: {
          organizationId,
          classSessionId: sessionId,
          title: dto.title,
          url: dto.url,
          description: dto.description,
        },
      });
    });
  }

  async completeSession(organizationId: string, sessionId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const session = await tx.classSession.findUnique({ where: { id: sessionId } });
      if (!session) throw new NotFoundException("Class session not found");
      if (!session.actualSyllabusNodeId) {
        throw new BadRequestException("Record the actual topic taught before marking the class completed");
      }

      return tx.classSession.update({
        where: { id: sessionId },
        data: { status: "COMPLETED", completedAt: new Date() },
        include: SESSION_INCLUDE,
      });
    });
  }

  // Computed, not stored (see schema.prisma's comment on why
  // syllabus_progress isn't a table): a node's progress is just "is
  // there a COMPLETED class session whose actualSyllabusNodeId is this
  // node." Copy-pasted from DashboardsService.computeSyllabusProgress
  // rather than called — Prisma doesn't support nested `$transaction`
  // calls, so this can't be a cross-module call into an already-open
  // `tx`. Batched the identical way (Phase 8 performance-optimization
  // slice: one classSession query for every node instead of N).
  async syllabusProgress(organizationId: string, syllabusId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const syllabus = await tx.syllabus.findUnique({ where: { id: syllabusId } });
      if (!syllabus) throw new NotFoundException("Syllabus not found");

      const nodes = await tx.syllabusNode.findMany({ where: { organizationId, syllabusId } });
      const nodeIds = nodes.map((n) => n.id);
      const completedSessions = nodeIds.length
        ? await tx.classSession.findMany({
            where: { organizationId, actualSyllabusNodeId: { in: nodeIds }, status: "COMPLETED" },
            orderBy: { completedAt: "asc" },
          })
        : [];
      const earliestByNode = new Map<string, (typeof completedSessions)[number]>();
      for (const session of completedSessions) {
        if (session.actualSyllabusNodeId && !earliestByNode.has(session.actualSyllabusNodeId)) {
          earliestByNode.set(session.actualSyllabusNodeId, session);
        }
      }
      return nodes.map((node) => {
        const completedSession = earliestByNode.get(node.id);
        return {
          nodeId: node.id,
          name: node.name,
          level: node.level,
          status: completedSession ? "COMPLETED" : "NOT_STARTED",
          completedAt: completedSession?.completedAt ?? null,
        };
      });
    });
  }
}
