import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { seededShuffle } from "../exam-taking/shuffle";
import { CreateKnowledgeCheckDto } from "./dto/create-knowledge-check.dto";
import { CreateQuestionDto } from "./dto/create-question.dto";
import { CreateAttemptDto } from "./dto/create-attempt.dto";
import { SaveQuizAnswerDto } from "./dto/save-quiz-answer.dto";

const CHECK_INCLUDE = {
  teachingAssignment: { include: { subject: true, section: true, employee: true } },
  syllabusNode: true,
  questions: { orderBy: { sequence: "asc" as const } },
  attempts: { include: { student: true } },
};

const CHECK_WITH_QUESTIONS = {
  teachingAssignment: { include: { subject: true, employee: true } },
  questions: { orderBy: { sequence: "asc" as const } },
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
          submittedAt: new Date(),
        },
        include: { student: true },
      });
    });
  }

  // ── Self-service quiz-taking (LMS discovery slice 4) ─────────────────
  // Adapts exam-taking's proven shuffle/autosave/auto-score engine
  // (seededShuffle, translate-shuffled-index-back-to-real, never trust a
  // client-submitted score) onto KnowledgeCheck instead of forking a
  // parallel implementation. Unlike the admin `attempt()` method above
  // (which records a whole attempt atomically, e.g. for a paper-based
  // in-class check), these methods drive a real question-by-question
  // session: start creates/resumes an in-progress KnowledgeCheckAttempt,
  // saveAnswer autosaves one KnowledgeCheckAnswer at a time, submit
  // scores from whatever was saved. Called by student-portal, which does
  // its own enrollment check before every call here — studentId always
  // comes from the caller's own linked Student row, never a request
  // param.

  async getPublishedCheckSummary(organizationId: string, checkId: string, studentId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const check = await this.requirePublishedCheck(tx, checkId);
      const attempt = await tx.knowledgeCheckAttempt.findUnique({
        where: { knowledgeCheckId_studentId: { knowledgeCheckId: checkId, studentId } },
      });
      return this.toQuizSummary(check, attempt);
    });
  }

  async startAttempt(organizationId: string, checkId: string, studentId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const check = await this.requirePublishedCheck(tx, checkId);
      let attempt = await tx.knowledgeCheckAttempt.findUnique({
        where: { knowledgeCheckId_studentId: { knowledgeCheckId: checkId, studentId } },
      });
      if (attempt?.submittedAt) throw new ConflictException("You have already submitted this quiz");

      // Idempotent, same as TeacherPortalService.createSession — a
      // student re-opening the quiz page (or refreshing) resumes the
      // same in-progress attempt rather than erroring or restarting the
      // timer.
      if (!attempt) {
        attempt = await tx.knowledgeCheckAttempt.create({
          data: { organizationId, knowledgeCheckId: checkId, studentId, startedAt: new Date() },
        });
      }

      return this.buildQuizState(tx, attempt, check);
    });
  }

  async saveAnswer(organizationId: string, checkId: string, studentId: string, questionId: string, dto: SaveQuizAnswerDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const check = await this.requirePublishedCheck(tx, checkId);
      const attempt = await this.requireOwnInProgressAttempt(tx, checkId, studentId);

      const deadline = this.computeDeadline(attempt.startedAt!, check.durationMinutes);
      if (deadline && new Date() > deadline) throw new BadRequestException("This quiz's time limit has passed");

      const question = check.questions.find((q) => q.id === questionId);
      if (!question) throw new NotFoundException("Question not found in this quiz");

      // Translate the displayed (shuffled) position back to the
      // question's real option index — see exam-taking/shuffle.ts.
      const order = seededShuffle(
        (question.options as string[]).map((_, i) => i),
        `${attempt.id}:${question.id}`,
      );
      const realIndex = order[dto.selectedOptionIndex];
      if (realIndex === undefined) throw new BadRequestException("selectedOptionIndex out of range");

      return tx.knowledgeCheckAnswer.upsert({
        where: { knowledgeCheckAttemptId_questionId: { knowledgeCheckAttemptId: attempt.id, questionId } },
        create: { organizationId, knowledgeCheckAttemptId: attempt.id, questionId, selectedOptionIndex: realIndex },
        update: { selectedOptionIndex: realIndex },
      });
    });
  }

  async submitAttempt(organizationId: string, checkId: string, studentId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const check = await this.requirePublishedCheck(tx, checkId);
      const attempt = await this.requireOwnInProgressAttempt(tx, checkId, studentId);

      const savedAnswers = await tx.knowledgeCheckAnswer.findMany({ where: { knowledgeCheckAttemptId: attempt.id } });
      const byQuestionId = new Map(savedAnswers.map((a) => [a.questionId, a.selectedOptionIndex]));

      // number[] in the same order as check.questions, matching the
      // shape the admin-recorded path already stores. An unanswered
      // question is stored as -1 — never equal to a real
      // correctOptionIndex (always >= 0), so it just scores 0.
      const answers = check.questions.map((q) => byQuestionId.get(q.id) ?? -1);
      // Never trust a client-submitted score — same rule ExamTakingService
      // and the admin attempt() method above already follow.
      const correctCount = check.questions.reduce(
        (count, q, i) => count + (answers[i] === q.correctOptionIndex ? 1 : 0),
        0,
      );
      const score = (correctCount / check.questions.length) * 100;

      const updated = await tx.knowledgeCheckAttempt.update({
        where: { id: attempt.id },
        data: { answers, score, submittedAt: new Date() },
      });
      return this.toQuizSummary(check, updated);
    });
  }

  private async requirePublishedCheck(tx: PrismaClient, checkId: string) {
    const check = await tx.knowledgeCheck.findUnique({ where: { id: checkId }, include: CHECK_WITH_QUESTIONS });
    if (!check || check.status !== "PUBLISHED") throw new NotFoundException("Quiz not found");
    return check;
  }

  private async requireOwnInProgressAttempt(tx: PrismaClient, checkId: string, studentId: string) {
    const attempt = await tx.knowledgeCheckAttempt.findUnique({
      where: { knowledgeCheckId_studentId: { knowledgeCheckId: checkId, studentId } },
    });
    if (!attempt || !attempt.startedAt) throw new NotFoundException("Start the quiz before saving answers");
    if (attempt.submittedAt) throw new ConflictException("This quiz has already been submitted");
    return attempt;
  }

  private computeDeadline(startedAt: Date, durationMinutes: number | null): Date | null {
    if (!durationMinutes) return null;
    return new Date(startedAt.getTime() + durationMinutes * 60_000);
  }

  private toQuizSummary(
    check: { id: string; title: string; durationMinutes: number | null; questions: { id: string }[]; teachingAssignment: unknown },
    attempt: { startedAt: Date | null; submittedAt: Date | null; score: number | null } | null,
  ) {
    return {
      id: check.id,
      title: check.title,
      durationMinutes: check.durationMinutes,
      questionCount: check.questions.length,
      teachingAssignment: check.teachingAssignment,
      myAttempt: attempt
        ? { startedAt: attempt.startedAt, submittedAt: attempt.submittedAt, score: attempt.score }
        : null,
    };
  }

  // Shuffled question order + options, never the correct answer — same
  // shape/guarantee as ExamTakingService.buildExamState.
  private async buildQuizState(
    tx: PrismaClient,
    attempt: { id: string; startedAt: Date | null },
    check: {
      durationMinutes: number | null;
      questions: Array<{ id: string; text: string; options: unknown }>;
    },
  ) {
    const orderedQuestions = seededShuffle(check.questions, attempt.id);
    const savedAnswers = await tx.knowledgeCheckAnswer.findMany({ where: { knowledgeCheckAttemptId: attempt.id } });
    const deadline = this.computeDeadline(attempt.startedAt!, check.durationMinutes);

    return {
      deadline: deadline?.toISOString() ?? null,
      questions: orderedQuestions.map((q) => {
        const saved = savedAnswers.find((a) => a.questionId === q.id);
        const order = seededShuffle((q.options as string[]).map((_, i) => i), `${attempt.id}:${q.id}`);
        const options = order.map((i) => (q.options as string[])[i]);
        const selectedOptionIndex = saved ? order.indexOf(saved.selectedOptionIndex) : undefined;
        return { id: q.id, text: q.text, options, selectedOptionIndex };
      }),
    };
  }
}
