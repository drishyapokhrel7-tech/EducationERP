import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateKnowledgeCheckDto } from "./dto/create-knowledge-check.dto";
import { CreateQuestionDto } from "./dto/create-question.dto";
import { CreateAttemptDto } from "./dto/create-attempt.dto";

const CHECK_INCLUDE = {
  teachingAssignment: { include: { subject: true, section: true, employee: true } },
  syllabusNode: true,
  questions: { orderBy: { sequence: "asc" as const } },
  attempts: { include: { student: true } },
};

/** Same FK-vs-RLS parent-guard pattern as every prior slice's service. */
@Injectable()
export class KnowledgeChecksService {
  constructor(private readonly prisma: PrismaService) {}

  listChecks(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.knowledgeCheck.findMany({ where: { organizationId }, include: CHECK_INCLUDE, orderBy: { createdAt: "desc" } }),
    );
  }

  async createCheck(organizationId: string, dto: CreateKnowledgeCheckDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const teachingAssignment = await tx.teachingAssignment.findUnique({ where: { id: dto.teachingAssignmentId } });
      if (!teachingAssignment) throw new NotFoundException("Teaching assignment not found");

      if (dto.syllabusNodeId) {
        const node = await tx.syllabusNode.findUnique({ where: { id: dto.syllabusNodeId } });
        if (!node) throw new NotFoundException("Syllabus node not found");
      }

      return tx.knowledgeCheck.create({
        data: {
          organizationId,
          teachingAssignmentId: dto.teachingAssignmentId,
          syllabusNodeId: dto.syllabusNodeId,
          title: dto.title,
          durationMinutes: dto.durationMinutes,
        },
        include: CHECK_INCLUDE,
      });
    });
  }

  async getCheck(organizationId: string, checkId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const check = await tx.knowledgeCheck.findUnique({ where: { id: checkId }, include: CHECK_INCLUDE });
      if (!check) throw new NotFoundException("Knowledge check not found");
      return check;
    });
  }

  async addQuestion(organizationId: string, checkId: string, dto: CreateQuestionDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const check = await tx.knowledgeCheck.findUnique({ where: { id: checkId } });
      if (!check) throw new NotFoundException("Knowledge check not found");
      if (check.status === "PUBLISHED") {
        throw new BadRequestException("Cannot add questions to a published knowledge check");
      }
      if (dto.correctOptionIndex >= dto.options.length) {
        throw new BadRequestException("correctOptionIndex must be a valid index into options");
      }

      return tx.knowledgeCheckQuestion.create({
        data: {
          organizationId,
          knowledgeCheckId: checkId,
          sequence: dto.sequence,
          text: dto.text,
          options: dto.options,
          correctOptionIndex: dto.correctOptionIndex,
        },
      });
    });
  }

  async publish(organizationId: string, checkId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const check = await tx.knowledgeCheck.findUnique({ where: { id: checkId }, include: { questions: true } });
      if (!check) throw new NotFoundException("Knowledge check not found");
      if (check.status === "PUBLISHED") throw new BadRequestException("Already published");
      if (check.questions.length === 0) throw new BadRequestException("Add at least one question before publishing");

      return tx.knowledgeCheck.update({ where: { id: checkId }, data: { status: "PUBLISHED" }, include: CHECK_INCLUDE });
    });
  }

  async attempt(organizationId: string, checkId: string, dto: CreateAttemptDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const check = await tx.knowledgeCheck.findUnique({
        where: { id: checkId },
        include: { questions: { orderBy: { sequence: "asc" } } },
      });
      if (!check) throw new NotFoundException("Knowledge check not found");
      if (check.status !== "PUBLISHED") {
        throw new BadRequestException("This knowledge check has not been published yet");
      }

      const student = await tx.student.findUnique({ where: { id: dto.studentId } });
      if (!student) throw new NotFoundException("Student not found");

      if (dto.answers.length !== check.questions.length) {
        throw new BadRequestException(`Expected ${check.questions.length} answers, got ${dto.answers.length}`);
      }

      const existing = await tx.knowledgeCheckAttempt.findUnique({
        where: { knowledgeCheckId_studentId: { knowledgeCheckId: checkId, studentId: dto.studentId } },
      });
      if (existing) throw new ConflictException("This student has already attempted this knowledge check");

      const correctCount = check.questions.reduce(
        (count, question, i) => count + (dto.answers[i] === question.correctOptionIndex ? 1 : 0),
        0,
      );
      const score = (correctCount / check.questions.length) * 100;

      return tx.knowledgeCheckAttempt.create({
        data: {
          organizationId,
          knowledgeCheckId: checkId,
          studentId: dto.studentId,
          answers: dto.answers,
          score,
        },
        include: { student: true },
      });
    });
  }
}
