import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Pure read-only aggregation over data every prior Phase 3 slice (plus
 * Phase 2's Student/Guardian) already built — no new tables. Scoped to
 * what's actually implemented: plan §13's Teacher/Student/Parent
 * dashboards also mention fees, exams and AI features that don't exist
 * yet (Phase 4/5/7), so those are simply absent here rather than faked.
 * These are admin-facing views, not real per-role authenticated
 * portals — no teacher/student/parent login exists yet (same gap noted
 * throughout Phase 3), so an admin looks at "what a teacher/student/
 * parent would see" rather than that person logging in themselves.
 *
 * studentDashboard's logic is reused by parentDashboard, and
 * syllabusProgress's logic is duplicated from ClassSessionsService
 * rather than called — Prisma does not support nested `$transaction`
 * calls, so a shared helper must take the already-open `tx` and be
 * called *within* one withTenant, not open a second one.
 */
@Injectable()
export class DashboardsService {
  constructor(private readonly prisma: PrismaService) {}

  // Phase 8 performance-optimization slice: was one classSession
  // findFirst per node (N+1). One query for every node's completed
  // sessions instead, ordered ascending so the first entry kept per
  // node below is the earliest completion — same semantics as the
  // original per-node findFirst(orderBy: completedAt asc).
  private async computeSyllabusProgress(tx: PrismaClient, organizationId: string, syllabusId: string) {
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
        status: completedSession ? ("COMPLETED" as const) : ("NOT_STARTED" as const),
        completedAt: completedSession?.completedAt ?? null,
      };
    });
  }

  private async buildStudentDashboard(tx: PrismaClient, organizationId: string, studentId: string) {
    const student = await tx.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException("Student not found");

    const activeEnrollment = await tx.studentEnrollment.findFirst({
      where: { organizationId, studentId, status: "ACTIVE" },
      include: { program: true, section: true, term: true },
    });

    const fetchWeeklyTimetable = async (): Promise<unknown[]> => {
      if (!activeEnrollment) return [];
      return tx.classSchedule.findMany({
        where: { organizationId, sectionId: activeEnrollment.sectionId, termId: activeEnrollment.termId },
        include: { period: true, room: true, teachingAssignment: { include: { subject: true, employee: true } } },
        orderBy: [{ dayOfWeek: "asc" }, { period: { sequence: "asc" } }],
      });
    };

    const fetchSyllabusProgress = async () => {
      if (!activeEnrollment) return [];
      const curricula = await tx.curriculum.findMany({
        where: { organizationId, programId: activeEnrollment.programId },
        include: { subjects: { include: { subject: true } } },
      });
      const syllabi = await tx.syllabus.findMany({
        where: {
          organizationId,
          termId: activeEnrollment.termId,
          curriculumSubjectId: { in: curricula.flatMap((c) => c.subjects.map((s) => s.id)) },
        },
        include: { curriculumSubject: { include: { subject: true } } },
      });
      return Promise.all(
        syllabi.map(async (syllabus) => ({
          subjectName: syllabus.curriculumSubject.subject.name,
          nodes: await this.computeSyllabusProgress(tx, organizationId, syllabus.id),
        })),
      );
    };

    // The five queries below are mutually independent (each keyed only off
    // studentId/activeEnrollment already resolved above), so they run
    // concurrently rather than as sequential round-trips — this matters
    // because buildStudentDashboard is invoked once per linked child inside
    // parentDashboard's single withTenant transaction, and the 15000ms
    // transaction timeout was observed to be tight under real latency.
    const [weeklyTimetable, syllabusProgress, attendanceRecords, assignmentSubmissions, knowledgeCheckAttempts] =
      await Promise.all([
        fetchWeeklyTimetable(),
        fetchSyllabusProgress(),
        tx.studentAttendance.findMany({ where: { organizationId, studentId } }),
        tx.assignmentSubmission.findMany({
          where: { organizationId, studentId },
          include: { assignment: true },
          orderBy: { submittedAt: "desc" },
        }),
        tx.knowledgeCheckAttempt.findMany({
          where: { organizationId, studentId },
          include: { knowledgeCheck: true },
          orderBy: { submittedAt: "desc" },
        }),
      ]);

    const attendanceSummary = {
      present: attendanceRecords.filter((a) => a.status === "PRESENT").length,
      absent: attendanceRecords.filter((a) => a.status === "ABSENT").length,
      late: attendanceRecords.filter((a) => a.status === "LATE").length,
      excused: attendanceRecords.filter((a) => a.status === "EXCUSED").length,
      total: attendanceRecords.length,
    };

    return {
      student,
      activeEnrollment,
      weeklyTimetable,
      attendanceSummary,
      assignmentSubmissions,
      knowledgeCheckAttempts,
      syllabusProgress,
    };
  }

  async teacherDashboard(organizationId: string, employeeId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const employee = await tx.employee.findUnique({ where: { id: employeeId } });
      if (!employee) throw new NotFoundException("Employee not found");

      const teachingAssignments = await tx.teachingAssignment.findMany({
        where: { organizationId, employeeId },
        include: { subject: true, section: true, term: true },
      });
      const teachingAssignmentIds = teachingAssignments.map((t) => t.id);

      // classSchedules and assignments both key off teachingAssignmentIds
      // only (not off each other), and staffAttendanceRecords is fully
      // independent, so all three run concurrently rather than sequentially.
      const [classSchedules, assignments, staffAttendanceRecords] = await Promise.all([
        tx.classSchedule.findMany({
          where: { organizationId, teachingAssignmentId: { in: teachingAssignmentIds } },
          include: { period: true, room: true, section: true, teachingAssignment: { include: { subject: true } } },
          orderBy: [{ dayOfWeek: "asc" }, { period: { sequence: "asc" } }],
        }),
        tx.assignment.findMany({
          where: { organizationId, teachingAssignmentId: { in: teachingAssignmentIds } },
          include: { submissions: { where: { status: "SUBMITTED" }, include: { student: true } } },
        }),
        tx.staffAttendance.findMany({ where: { organizationId, employeeId } }),
      ]);
      const pendingGrading = assignments.flatMap((a) =>
        a.submissions.map((s) => ({ ...s, assignmentTitle: a.title })),
      );

      const recentClassSessions = await tx.classSession.findMany({
        where: { organizationId, classScheduleId: { in: classSchedules.map((c) => c.id) } },
        include: { actualSyllabusNode: true, section: true },
        orderBy: { date: "desc" },
        take: 10,
      });

      const staffAttendanceSummary = {
        present: staffAttendanceRecords.filter((a) => a.status === "PRESENT").length,
        absent: staffAttendanceRecords.filter((a) => a.status === "ABSENT").length,
        late: staffAttendanceRecords.filter((a) => a.status === "LATE").length,
        onLeave: staffAttendanceRecords.filter((a) => a.status === "ON_LEAVE").length,
        total: staffAttendanceRecords.length,
      };

      return {
        employee,
        teachingAssignments,
        classSchedules,
        pendingGrading,
        recentClassSessions,
        staffAttendanceSummary,
      };
    });
  }

  async studentDashboard(organizationId: string, studentId: string) {
    return this.prisma.withTenant(organizationId, (tx) => this.buildStudentDashboard(tx, organizationId, studentId));
  }

  async parentDashboard(organizationId: string, guardianId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const guardian = await tx.guardian.findUnique({ where: { id: guardianId } });
      if (!guardian) throw new NotFoundException("Guardian not found");

      // Only children actually linked to this guardian — the plan §8
      // requirement ("Parent views must expose only authorized child
      // information") enforced structurally, not just by convention.
      const links = await tx.studentGuardian.findMany({
        where: { organizationId, guardianId },
        include: { student: true },
      });

      const children = await Promise.all(
        links.map(async (link) => ({
          relationship: link.relationship,
          isPrimaryContact: link.isPrimaryContact,
          ...(await this.buildStudentDashboard(tx, organizationId, link.studentId)),
        })),
      );

      return { guardian, children };
    });
  }
}
