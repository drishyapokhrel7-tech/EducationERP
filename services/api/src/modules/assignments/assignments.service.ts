import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateAssignmentDto } from "./dto/create-assignment.dto";
import { CreateSubmissionDto } from "./dto/create-submission.dto";
import { GradeSubmissionDto } from "./dto/grade-submission.dto";
import { UpdateAssignmentDto } from "./dto/update-assignment.dto";

const ASSIGNMENT_INCLUDE = {
  teachingAssignment: { include: { subject: true, section: true, employee: true } },
  submissions: { include: { student: true } },
} as const;

/** Same FK-vs-RLS parent-guard pattern as every prior slice's service. */
@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  listAssignments(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.assignment.findMany({ where: { organizationId }, include: ASSIGNMENT_INCLUDE, orderBy: { createdAt: "desc" } }),
    );
  }

  async createAssignment(organizationId: string, dto: CreateAssignmentDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const teachingAssignment = await tx.teachingAssignment.findUnique({ where: { id: dto.teachingAssignmentId } });
      if (!teachingAssignment) throw new NotFoundException("Teaching assignment not found");

      return tx.assignment.create({
        data: {
          organizationId,
          teachingAssignmentId: dto.teachingAssignmentId,
          title: dto.title,
          description: dto.description,
          submissionType: dto.submissionType,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          allowResubmission: dto.allowResubmission ?? false,
          maxScore: dto.maxScore,
        },
        include: ASSIGNMENT_INCLUDE,
      });
    });
  }

  async getAssignment(organizationId: string, assignmentId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const assignment = await tx.assignment.findUnique({ where: { id: assignmentId }, include: ASSIGNMENT_INCLUDE });
      if (!assignment) throw new NotFoundException("Assignment not found");
      return assignment;
    });
  }

  async updateAssignment(organizationId: string, assignmentId: string, dto: UpdateAssignmentDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const existing = await tx.assignment.findUnique({ where: { id: assignmentId } });
      if (!existing) throw new NotFoundException("Assignment not found");

      return tx.assignment.update({
        where: { id: assignmentId },
        data: {
          title: dto.title,
          description: dto.description,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          allowResubmission: dto.allowResubmission,
          maxScore: dto.maxScore,
          isPublished: dto.isPublished,
        },
        include: ASSIGNMENT_INCLUDE,
      });
    });
  }

  async submit(organizationId: string, assignmentId: string, dto: CreateSubmissionDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const assignment = await tx.assignment.findUnique({ where: { id: assignmentId } });
      if (!assignment) throw new NotFoundException("Assignment not found");

      const student = await tx.student.findUnique({ where: { id: dto.studentId } });
      if (!student) throw new NotFoundException("Student not found");

      const existing = await tx.assignmentSubmission.findUnique({
        where: { assignmentId_studentId: { assignmentId, studentId: dto.studentId } },
      });
      if (existing && !assignment.allowResubmission) {
        throw new ConflictException("This assignment does not allow resubmission");
      }

      return tx.assignmentSubmission.upsert({
        where: { assignmentId_studentId: { assignmentId, studentId: dto.studentId } },
        // A resubmission's content changed, so its previous grade no
        // longer applies — reset to SUBMITTED rather than leaving a
        // stale score/feedback attached to new content.
        update: { content: dto.content, submittedAt: new Date(), status: "SUBMITTED", score: null, feedback: null },
        create: {
          organizationId,
          assignmentId,
          studentId: dto.studentId,
          content: dto.content,
        },
        include: { student: true },
      });
    });
  }

  async grade(organizationId: string, assignmentId: string, studentId: string, dto: GradeSubmissionDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const submission = await tx.assignmentSubmission.findUnique({
        where: { assignmentId_studentId: { assignmentId, studentId } },
      });
      if (!submission) throw new NotFoundException("Submission not found");

      return tx.assignmentSubmission.update({
        where: { id: submission.id },
        data: { score: dto.score, feedback: dto.feedback, status: "GRADED" },
        include: { student: true },
      });
    });
  }
}
