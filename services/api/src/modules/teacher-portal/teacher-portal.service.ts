import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { DashboardsService } from "../dashboards/dashboards.service";
import { AssignmentsService } from "../assignments/assignments.service";
import { CreateClassSessionDto } from "../class-sessions/dto/create-class-session.dto";
import { RecordProgressDto } from "../class-sessions/dto/record-progress.dto";
import { CreateClassMaterialDto } from "../class-sessions/dto/create-class-material.dto";
import { CreateCourseModuleDto } from "./dto/create-course-module.dto";
import { UpdateCourseModuleDto } from "./dto/update-course-module.dto";
import { CreateCourseModuleItemDto } from "./dto/create-course-module-item.dto";
import { UpdateCourseModuleItemDto } from "./dto/update-course-module-item.dto";
import { CreateAssignmentDto } from "../assignments/dto/create-assignment.dto";
import { UpdateAssignmentDto } from "../assignments/dto/update-assignment.dto";
import { GradeSubmissionDto } from "../assignments/dto/grade-submission.dto";

const SESSION_INCLUDE = {
  classSchedule: {
    include: { period: true, room: true, teachingAssignment: { include: { subject: true, employee: true } } },
  },
  section: true,
  lessonPlan: true,
  actualSyllabusNode: true,
  materials: true,
} as const;

const MODULE_INCLUDE = { items: { orderBy: { sequence: "asc" as const } } };

// Same weekday conversion as ClassSessionsService.myClassesToday — kept
// in sync deliberately, not imported, since Prisma doesn't support
// nested $transaction calls (see DashboardsService's own comment on
// this exact constraint).
function isoDayOfWeek(date: Date): number {
  return ((date.getUTCDay() + 6) % 7) + 1;
}

/**
 * Self-service, not admin-facing — same shape as student-portal/
 * driver-portal: the caller's own Employee is derived from `WHERE
 * userId = jwt.sub`, and every class-session action is ownership-
 * checked against that employee's own TeachingAssignment rows before
 * any read or write, never trusted from a request param. This is the
 * gap flagged in the LMS discovery pass — "My Classes Today" and the
 * teacher dashboard were both admin-facing, gated by a resource:action
 * permission rather than derived from the caller's own identity.
 */
@Injectable()
export class TeacherPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboards: DashboardsService,
    private readonly assignments: AssignmentsService,
  ) {}

  async getMe(organizationId: string, userId: string) {
    const employee = await this.getOwnEmployee(organizationId, userId);
    return this.dashboards.teacherDashboard(organizationId, employee.id);
  }

  // Same shape as ClassSessionsService.myClassesToday, scoped to only
  // the caller's own TeachingAssignment rows instead of the whole org.
  async myClassesToday(organizationId: string, userId: string, dateStr: string) {
    const employee = await this.getOwnEmployee(organizationId, userId);
    const date = new Date(dateStr);
    const dayOfWeek = isoDayOfWeek(date);

    return this.prisma.withTenant(organizationId, async (tx) => {
      const schedules = await tx.classSchedule.findMany({
        where: { organizationId, dayOfWeek, teachingAssignment: { employeeId: employee.id } },
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
        const classSession = await tx.classSession.findUnique({
          where: { classScheduleId_date: { classScheduleId: schedule.id, date } },
        });
        results.push({ classSchedule: schedule, classSession });
      }
      return results;
    });
  }

  async createSession(organizationId: string, userId: string, dto: CreateClassSessionDto) {
    const employee = await this.getOwnEmployee(organizationId, userId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      const classSchedule = await tx.classSchedule.findUnique({
        where: { id: dto.classScheduleId },
        include: { teachingAssignment: true },
      });
      if (!classSchedule || classSchedule.teachingAssignment.employeeId !== employee.id) {
        throw new NotFoundException("Class schedule not found");
      }

      if (dto.lessonPlanId) {
        const lessonPlan = await tx.lessonPlan.findUnique({ where: { id: dto.lessonPlanId } });
        if (!lessonPlan || lessonPlan.teachingAssignmentId !== classSchedule.teachingAssignmentId) {
          throw new NotFoundException("Lesson plan not found");
        }
      }

      const date = new Date(dto.date);
      // Idempotent, unlike the admin endpoint's 409 — a teacher tapping
      // "open today's class" twice (e.g. a double click) should just
      // land on the already-open session, not see an error.
      const existing = await tx.classSession.findUnique({
        where: { classScheduleId_date: { classScheduleId: dto.classScheduleId, date } },
        include: SESSION_INCLUDE,
      });
      if (existing) return existing;

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

  async getSession(organizationId: string, userId: string, sessionId: string) {
    const employee = await this.getOwnEmployee(organizationId, userId);
    return this.prisma.withTenant(organizationId, (tx) => this.loadOwnSession(tx, employee.id, sessionId));
  }

  // Feeds the "actual topic taught" picker on the record-progress form
  // — the admin equivalent browses the full syllabus catalog
  // (syllabus:view), which a roleless teacher login can't reach, so
  // this resolves it scoped to exactly the session's own subject+term.
  async getSyllabusNodesForSession(organizationId: string, userId: string, sessionId: string) {
    const employee = await this.getOwnEmployee(organizationId, userId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      const session = await this.loadOwnSession(tx, employee.id, sessionId);
      const { subjectId, termId } = session.classSchedule.teachingAssignment;

      const curriculumSubjects = await tx.curriculumSubject.findMany({ where: { organizationId, subjectId } });
      const syllabi = await tx.syllabus.findMany({
        where: { organizationId, termId, curriculumSubjectId: { in: curriculumSubjects.map((cs) => cs.id) } },
      });
      return tx.syllabusNode.findMany({
        where: { organizationId, syllabusId: { in: syllabi.map((s) => s.id) } },
        orderBy: [{ level: "asc" }, { sequence: "asc" }],
      });
    });
  }

  async recordProgress(organizationId: string, userId: string, sessionId: string, dto: RecordProgressDto) {
    const employee = await this.getOwnEmployee(organizationId, userId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      const session = await this.loadOwnSession(tx, employee.id, sessionId);

      if (dto.actualSyllabusNodeId) {
        const node = await tx.syllabusNode.findUnique({ where: { id: dto.actualSyllabusNodeId } });
        if (!node) throw new NotFoundException("Syllabus node not found");
      }

      return tx.classSession.update({
        where: { id: sessionId },
        data: {
          actualSyllabusNodeId: dto.actualSyllabusNodeId,
          progressNotes: dto.progressNotes,
          status: session.status === "SCHEDULED" ? "IN_PROGRESS" : session.status,
        },
        include: SESSION_INCLUDE,
      });
    });
  }

  async addMaterial(organizationId: string, userId: string, sessionId: string, dto: CreateClassMaterialDto) {
    const employee = await this.getOwnEmployee(organizationId, userId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadOwnSession(tx, employee.id, sessionId);
      return tx.classMaterial.create({
        data: { organizationId, classSessionId: sessionId, title: dto.title, url: dto.url, description: dto.description },
      });
    });
  }

  async completeSession(organizationId: string, userId: string, sessionId: string) {
    const employee = await this.getOwnEmployee(organizationId, userId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      const session = await this.loadOwnSession(tx, employee.id, sessionId);
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

  // ── Course modules & content (LMS discovery slice 2) ────────────────

  async listModules(organizationId: string, userId: string, teachingAssignmentId: string) {
    const employee = await this.getOwnEmployee(organizationId, userId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.assertOwnsTeachingAssignment(tx, employee.id, teachingAssignmentId);
      return tx.courseModule.findMany({
        where: { organizationId, teachingAssignmentId },
        include: MODULE_INCLUDE,
        orderBy: { sequence: "asc" },
      });
    });
  }

  async createModule(organizationId: string, userId: string, dto: CreateCourseModuleDto) {
    const employee = await this.getOwnEmployee(organizationId, userId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.assertOwnsTeachingAssignment(tx, employee.id, dto.teachingAssignmentId);
      return tx.courseModule.create({
        data: {
          organizationId,
          teachingAssignmentId: dto.teachingAssignmentId,
          title: dto.title,
          description: dto.description,
          sequence: dto.sequence,
        },
        include: MODULE_INCLUDE,
      });
    });
  }

  async updateModule(organizationId: string, userId: string, moduleId: string, dto: UpdateCourseModuleDto) {
    const employee = await this.getOwnEmployee(organizationId, userId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadOwnModule(tx, employee.id, moduleId);
      return tx.courseModule.update({
        where: { id: moduleId },
        data: { title: dto.title, description: dto.description, sequence: dto.sequence, isPublished: dto.isPublished },
        include: MODULE_INCLUDE,
      });
    });
  }

  async addModuleItem(organizationId: string, userId: string, moduleId: string, dto: CreateCourseModuleItemDto) {
    const employee = await this.getOwnEmployee(organizationId, userId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadOwnModule(tx, employee.id, moduleId);
      return tx.courseModuleItem.create({
        data: {
          organizationId,
          moduleId,
          sequence: dto.sequence,
          title: dto.title,
          type: dto.type,
          content: dto.content,
        },
      });
    });
  }

  async updateModuleItem(organizationId: string, userId: string, itemId: string, dto: UpdateCourseModuleItemDto) {
    const employee = await this.getOwnEmployee(organizationId, userId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadOwnModuleItem(tx, employee.id, itemId);
      return tx.courseModuleItem.update({
        where: { id: itemId },
        data: { title: dto.title, content: dto.content, sequence: dto.sequence, isPublished: dto.isPublished },
      });
    });
  }

  // ── Assignments (LMS discovery slice 3) ─────────────────────────────
  // Reuses AssignmentsService's already-tested create/update/grade
  // logic wholesale (same "reuse the existing service, add a
  // self-service ownership check in front" precedent as
  // DashboardsService above) — each call here does its own ownership
  // check first, then calls into AssignmentsService as an independent
  // top-level call (never nested inside this method's own withTenant,
  // since Prisma doesn't support nested $transaction calls).

  async listAssignments(organizationId: string, userId: string, teachingAssignmentId: string) {
    const employee = await this.getOwnEmployee(organizationId, userId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.assertOwnsTeachingAssignment(tx, employee.id, teachingAssignmentId);
      return tx.assignment.findMany({
        where: { organizationId, teachingAssignmentId },
        include: { submissions: { include: { student: true } } },
        orderBy: { createdAt: "desc" },
      });
    });
  }

  async createAssignment(organizationId: string, userId: string, dto: CreateAssignmentDto) {
    const employee = await this.getOwnEmployee(organizationId, userId);
    await this.prisma.withTenant(organizationId, (tx) =>
      this.assertOwnsTeachingAssignment(tx, employee.id, dto.teachingAssignmentId),
    );
    return this.assignments.createAssignment(organizationId, dto);
  }

  async getAssignmentDetail(organizationId: string, userId: string, assignmentId: string) {
    const employee = await this.getOwnEmployee(organizationId, userId);
    await this.assertOwnsAssignment(organizationId, employee.id, assignmentId);
    return this.assignments.getAssignment(organizationId, assignmentId);
  }

  async updateAssignment(organizationId: string, userId: string, assignmentId: string, dto: UpdateAssignmentDto) {
    const employee = await this.getOwnEmployee(organizationId, userId);
    await this.assertOwnsAssignment(organizationId, employee.id, assignmentId);
    return this.assignments.updateAssignment(organizationId, assignmentId, dto);
  }

  async gradeSubmission(
    organizationId: string,
    userId: string,
    assignmentId: string,
    studentId: string,
    dto: GradeSubmissionDto,
  ) {
    const employee = await this.getOwnEmployee(organizationId, userId);
    await this.assertOwnsAssignment(organizationId, employee.id, assignmentId);
    return this.assignments.grade(organizationId, assignmentId, studentId, dto);
  }

  private async assertOwnsAssignment(organizationId: string, employeeId: string, assignmentId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const assignment = await tx.assignment.findUnique({
        where: { id: assignmentId },
        include: { teachingAssignment: true },
      });
      if (!assignment || assignment.teachingAssignment.employeeId !== employeeId) {
        throw new NotFoundException("Assignment not found");
      }
      return assignment;
    });
  }

  private async assertOwnsTeachingAssignment(tx: PrismaClient, employeeId: string, teachingAssignmentId: string) {
    const ta = await tx.teachingAssignment.findUnique({ where: { id: teachingAssignmentId } });
    if (!ta || ta.employeeId !== employeeId) {
      throw new NotFoundException("Teaching assignment not found");
    }
    return ta;
  }

  private async loadOwnModule(tx: PrismaClient, employeeId: string, moduleId: string) {
    const module = await tx.courseModule.findUnique({
      where: { id: moduleId },
      include: { teachingAssignment: true },
    });
    if (!module || module.teachingAssignment.employeeId !== employeeId) {
      throw new NotFoundException("Course module not found");
    }
    return module;
  }

  private async loadOwnModuleItem(tx: PrismaClient, employeeId: string, itemId: string) {
    const item = await tx.courseModuleItem.findUnique({
      where: { id: itemId },
      include: { module: { include: { teachingAssignment: true } } },
    });
    if (!item || item.module.teachingAssignment.employeeId !== employeeId) {
      throw new NotFoundException("Course module item not found");
    }
    return item;
  }

  // Full SESSION_INCLUDE, not just enough to check ownership — this is
  // also what GET .../class-sessions/:sessionId returns directly, and
  // the client relies on `materials`/`section`/etc. always being
  // present (same under-fetch-vs-client-type-lie bug class this
  // project has hit before: check the shape a caller actually needs,
  // not just what the immediate check requires).
  private async loadOwnSession(tx: PrismaClient, employeeId: string, sessionId: string) {
    const session = await tx.classSession.findUnique({ where: { id: sessionId }, include: SESSION_INCLUDE });
    if (!session || session.classSchedule.teachingAssignment.employeeId !== employeeId) {
      throw new NotFoundException("Class session not found");
    }
    return session;
  }

  // 404s not just on "no Employee row" but also "no TeachingAssignment
  // at all" — same "no linked X record" semantics as student-portal
  // (Student) and driver-portal (Driver): an employee account that
  // isn't actually a teacher shouldn't get an (empty but 200) teacher
  // dashboard.
  private async getOwnEmployee(organizationId: string, userId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const employee = await tx.employee.findUnique({ where: { userId } });
      if (!employee || employee.organizationId !== organizationId) {
        throw new NotFoundException("No employee record is linked to this account");
      }
      const teachingAssignment = await tx.teachingAssignment.findFirst({ where: { organizationId, employeeId: employee.id } });
      if (!teachingAssignment) {
        throw new NotFoundException("No teaching assignments are linked to this account");
      }
      return employee;
    });
  }
}
