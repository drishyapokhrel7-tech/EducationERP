import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient, QuestionType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { seededShuffle } from "./shuffle";
import { SaveAnswerDto } from "./dto/save-answer.dto";

function combineDateAndTime(date: Date, hhmm: string): Date {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const combined = new Date(date);
  combined.setUTCHours(hours, minutes, 0, 0);
  return combined;
}

/**
 * Self-service, gated exactly like StudentPortalService (slice 4e) —
 * studentId is derived exclusively from the authenticated user's linked
 * Student row, never from a request param. See that module's comments
 * for why this is a deliberately different pattern from every
 * @RequirePermissions-gated module in this project.
 */
@Injectable()
export class ExamTakingService {
  constructor(private readonly prisma: PrismaService) {}

  async listMyExams(organizationId: string, userId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const student = await this.resolveStudent(tx, userId);
      return tx.examAttempt.findMany({
        where: { organizationId, studentId: student.id, examSubject: { questionBankId: { not: null } } },
        include: {
          examSubject: {
            include: {
              curriculumSubject: { include: { subject: true } },
              examSchedule: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    });
  }

  async startExam(organizationId: string, userId: string, examSubjectId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const student = await this.resolveStudent(tx, userId);
      const attempt = await this.requireOnlineAttempt(tx, student.id, examSubjectId);

      if (attempt.submittedAt) throw new ConflictException("You have already submitted this exam");

      const schedule = attempt.examSubject.examSchedule;
      if (!schedule) throw new BadRequestException("This exam has not been scheduled yet");

      const now = new Date();
      const windowStart = combineDateAndTime(schedule.date, schedule.startTime);
      const windowEnd = combineDateAndTime(schedule.date, schedule.endTime);

      if (!attempt.startedAt) {
        if (now < windowStart || now > windowEnd) {
          throw new BadRequestException("This exam is not currently open");
        }
        await tx.examAttempt.update({ where: { id: attempt.id }, data: { startedAt: now } });
      }

      return this.buildExamState(tx, attempt.id, attempt.examSubject.questionBank!.questions, windowEnd);
    });
  }

  async saveAnswer(organizationId: string, userId: string, examSubjectId: string, questionId: string, dto: SaveAnswerDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const student = await this.resolveStudent(tx, userId);
      const attempt = await this.requireOnlineAttempt(tx, student.id, examSubjectId);

      if (!attempt.startedAt) throw new BadRequestException("Start the exam before saving answers");
      if (attempt.submittedAt) throw new ConflictException("This exam has already been submitted");

      const schedule = attempt.examSubject.examSchedule;
      if (schedule && new Date() > combineDateAndTime(schedule.date, schedule.endTime)) {
        throw new BadRequestException("This exam's time window has closed");
      }

      const question = attempt.examSubject.questionBank!.questions.find((q) => q.id === questionId);
      if (!question) throw new NotFoundException("Question not found in this exam");

      let selectedOptionIndex: number | undefined;
      if (question.questionType === QuestionType.OBJECTIVE) {
        if (dto.selectedOptionIndex === undefined) {
          throw new BadRequestException("selectedOptionIndex is required for an objective question");
        }
        // Translate the displayed (shuffled) position back to the
        // question's real option index — see shuffle.ts.
        const order = seededShuffle(
          (question.options as string[]).map((_, i) => i),
          `${attempt.id}:${question.id}`,
        );
        const realIndex = order[dto.selectedOptionIndex];
        if (realIndex === undefined) throw new BadRequestException("selectedOptionIndex out of range");
        selectedOptionIndex = realIndex;
      }

      return tx.answer.upsert({
        where: { examAttemptId_questionId: { examAttemptId: attempt.id, questionId } },
        create: {
          organizationId,
          examAttemptId: attempt.id,
          questionId,
          selectedOptionIndex,
          textAnswer: question.questionType === QuestionType.SUBJECTIVE ? dto.textAnswer : undefined,
        },
        update: {
          selectedOptionIndex,
          textAnswer: question.questionType === QuestionType.SUBJECTIVE ? dto.textAnswer : undefined,
        },
      });
    });
  }

  async submitExam(organizationId: string, userId: string, examSubjectId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const student = await this.resolveStudent(tx, userId);
      const attempt = await this.requireOnlineAttempt(tx, student.id, examSubjectId);

      if (!attempt.startedAt) throw new BadRequestException("You have not started this exam");
      if (attempt.submittedAt) throw new ConflictException("This exam has already been submitted");

      const questions = attempt.examSubject.questionBank!.questions;
      const answers = await tx.answer.findMany({ where: { organizationId, examAttemptId: attempt.id } });

      // Auto-score every OBJECTIVE answer — never trust a
      // client-submitted score, same rule KnowledgeCheckAttempt and
      // ExamGradingService already follow. SUBJECTIVE answers are left
      // unscored for a human grader (4c/4d's existing admin actions).
      for (const question of questions) {
        if (question.questionType !== QuestionType.OBJECTIVE) continue;
        const answer = answers.find((a) => a.questionId === question.id);
        const score = answer?.selectedOptionIndex === question.correctOptionIndex ? question.marks : 0;
        if (answer) {
          await tx.answer.update({ where: { id: answer.id }, data: { score } });
        }
      }

      return tx.examAttempt.update({ where: { id: attempt.id }, data: { submittedAt: new Date() } });
    });
  }

  private async resolveStudent(tx: PrismaClient, userId: string) {
    const student = await tx.student.findUnique({ where: { userId } });
    if (!student) throw new NotFoundException("No student record is linked to this account");
    return student;
  }

  private async requireOnlineAttempt(tx: PrismaClient, studentId: string, examSubjectId: string) {
    const attempt = await tx.examAttempt.findUnique({
      where: { examSubjectId_studentId: { examSubjectId, studentId } },
      include: {
        examSubject: {
          include: { questionBank: { include: { questions: true } }, examSchedule: true },
        },
      },
    });
    if (!attempt) throw new NotFoundException("You are not registered for this exam");
    if (!attempt.examSubject.questionBank) {
      throw new BadRequestException("This exam subject is not delivered online");
    }
    return attempt;
  }

  private async buildExamState(
    tx: PrismaClient,
    examAttemptId: string,
    questions: Array<{
      id: string;
      text: string;
      questionType: QuestionType;
      marks: number;
      options: unknown;
    }>,
    deadline: Date,
  ) {
    const orderedQuestions = seededShuffle(questions, examAttemptId);
    const answers = await tx.answer.findMany({ where: { examAttemptId } });

    return {
      deadline: deadline.toISOString(),
      questions: orderedQuestions.map((q) => {
        const answer = answers.find((a) => a.questionId === q.id);
        let options: string[] | undefined;
        let selectedOptionIndex: number | undefined;
        if (q.questionType === QuestionType.OBJECTIVE) {
          const order = seededShuffle((q.options as string[]).map((_, i) => i), `${examAttemptId}:${q.id}`);
          options = order.map((i) => (q.options as string[])[i]);
          if (answer?.selectedOptionIndex !== undefined && answer?.selectedOptionIndex !== null) {
            selectedOptionIndex = order.indexOf(answer.selectedOptionIndex);
          }
        }
        return {
          id: q.id,
          text: q.text,
          questionType: q.questionType,
          marks: q.marks,
          options,
          selectedOptionIndex,
          textAnswer: answer?.textAnswer ?? undefined,
        };
      }),
    };
  }
}
