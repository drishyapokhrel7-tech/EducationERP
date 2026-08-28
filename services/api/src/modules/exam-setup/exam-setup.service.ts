import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, PrismaClient, QuestionType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateExamTypeDto } from "./dto/create-exam-type.dto";
import { UpdateExamTypeDto } from "./dto/update-exam-type.dto";
import { CreateGradingSchemeDto } from "./dto/create-grading-scheme.dto";
import { UpdateGradingSchemeDto } from "./dto/update-grading-scheme.dto";
import { CreateQuestionBankDto } from "./dto/create-question-bank.dto";
import { CreateQuestionDto } from "./dto/create-question.dto";
import { assertNoDependents } from "../../common/assert-no-dependents";

/** Same FK-vs-RLS parent-guard pattern as every prior slice's service. */
@Injectable()
export class ExamSetupService {
  constructor(private readonly prisma: PrismaService) {}

  listExamTypes(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.examType.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    );
  }

  async createExamType(organizationId: string, dto: CreateExamTypeDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const existing = await tx.examType.findUnique({
        where: { organizationId_code: { organizationId, code: dto.code } },
      });
      if (existing) throw new ConflictException("An exam type with this code already exists");

      return tx.examType.create({ data: { organizationId, name: dto.name, code: dto.code } });
    });
  }

  async updateExamType(organizationId: string, id: string, dto: UpdateExamTypeDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const examType = await this.loadExamType(tx, organizationId, id);
      if (dto.code && dto.code !== examType.code) {
        const existing = await tx.examType.findUnique({
          where: { organizationId_code: { organizationId, code: dto.code } },
        });
        if (existing) throw new ConflictException("An exam type with this code already exists");
      }
      return tx.examType.update({ where: { id }, data: dto });
    });
  }

  async deleteExamType(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadExamType(tx, organizationId, id);
      await assertNoDependents([tx.exam.count({ where: { examTypeId: id } })], "exam type");
      await tx.examType.delete({ where: { id } });
      return { deleted: true };
    });
  }

  private async loadExamType(tx: PrismaClient, organizationId: string, id: string) {
    const examType = await tx.examType.findUnique({ where: { id } });
    if (!examType || examType.organizationId !== organizationId) throw new NotFoundException("Exam type not found");
    return examType;
  }

  listGradingSchemes(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.gradingScheme.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    );
  }

  async createGradingScheme(organizationId: string, dto: CreateGradingSchemeDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const existing = await tx.gradingScheme.findUnique({
        where: { organizationId_code: { organizationId, code: dto.code } },
      });
      if (existing) throw new ConflictException("A grading scheme with this code already exists");

      // Bands don't need to be contiguous/non-overlapping to be usable
      // (an institution might intentionally leave a gap), but a
      // min > max on a single band is never meaningful.
      for (const band of dto.bands) {
        if (band.minPercentage > band.maxPercentage) {
          throw new BadRequestException(
            `Band "${band.grade}" has minPercentage greater than maxPercentage`,
          );
        }
      }

      return tx.gradingScheme.create({
        data: {
          organizationId,
          name: dto.name,
          code: dto.code,
          description: dto.description,
          // The DTO's optional band fields (gpa/remarks) are structurally
          // fine as JSON (an absent key, not a literal `undefined` value)
          // but TS's Json type doesn't model "class instance with
          // optional properties" — this cast asserts the runtime shape,
          // not a different one.
          bands: dto.bands as unknown as Prisma.InputJsonValue,
        },
      });
    });
  }

  async updateGradingScheme(organizationId: string, id: string, dto: UpdateGradingSchemeDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const gradingScheme = await this.loadGradingScheme(tx, organizationId, id);
      if (dto.code && dto.code !== gradingScheme.code) {
        const existing = await tx.gradingScheme.findUnique({
          where: { organizationId_code: { organizationId, code: dto.code } },
        });
        if (existing) throw new ConflictException("A grading scheme with this code already exists");
      }

      if (dto.bands) {
        for (const band of dto.bands) {
          if (band.minPercentage > band.maxPercentage) {
            throw new BadRequestException(
              `Band "${band.grade}" has minPercentage greater than maxPercentage`,
            );
          }
        }
      }

      return tx.gradingScheme.update({
        where: { id },
        data: {
          name: dto.name,
          code: dto.code,
          description: dto.description,
          bands: dto.bands ? (dto.bands as unknown as Prisma.InputJsonValue) : undefined,
        },
      });
    });
  }

  async deleteGradingScheme(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadGradingScheme(tx, organizationId, id);
      await assertNoDependents([tx.exam.count({ where: { gradingSchemeId: id } })], "grading scheme");
      await tx.gradingScheme.delete({ where: { id } });
      return { deleted: true };
    });
  }

  private async loadGradingScheme(tx: PrismaClient, organizationId: string, id: string) {
    const gradingScheme = await tx.gradingScheme.findUnique({ where: { id } });
    if (!gradingScheme || gradingScheme.organizationId !== organizationId) {
      throw new NotFoundException("Grading scheme not found");
    }
    return gradingScheme;
  }

  listQuestionBanks(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.questionBank.findMany({
        where: { organizationId },
        include: { curriculumSubject: { include: { subject: true, curriculum: true } } },
        orderBy: { name: "asc" },
      }),
    );
  }

  async createQuestionBank(organizationId: string, dto: CreateQuestionBankDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const curriculumSubject = await tx.curriculumSubject.findUnique({
        where: { id: dto.curriculumSubjectId },
      });
      if (!curriculumSubject) throw new NotFoundException("Curriculum subject not found");

      return tx.questionBank.create({
        data: {
          organizationId,
          curriculumSubjectId: dto.curriculumSubjectId,
          name: dto.name,
          description: dto.description,
        },
      });
    });
  }

  async getQuestionBank(organizationId: string, questionBankId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const questionBank = await tx.questionBank.findUnique({
        where: { id: questionBankId },
        include: { curriculumSubject: { include: { subject: true, curriculum: true } } },
      });
      if (!questionBank) throw new NotFoundException("Question bank not found");

      const questions = await tx.question.findMany({
        where: { organizationId, questionBankId },
        orderBy: { sequence: "asc" },
      });
      return { ...questionBank, questions };
    });
  }

  async addQuestion(organizationId: string, questionBankId: string, dto: CreateQuestionDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const questionBank = await tx.questionBank.findUnique({ where: { id: questionBankId } });
      if (!questionBank) throw new NotFoundException("Question bank not found");

      if (dto.questionType === QuestionType.OBJECTIVE) {
        if (dto.correctOptionIndex === undefined || dto.correctOptionIndex >= (dto.options?.length ?? 0)) {
          throw new BadRequestException("correctOptionIndex must be a valid index into options");
        }
      } else if (dto.options !== undefined || dto.correctOptionIndex !== undefined) {
        throw new BadRequestException("SUBJECTIVE questions cannot have options or correctOptionIndex");
      }

      return tx.question.create({
        data: {
          organizationId,
          questionBankId,
          sequence: dto.sequence,
          text: dto.text,
          questionType: dto.questionType,
          marks: dto.marks,
          options: dto.options,
          correctOptionIndex: dto.correctOptionIndex,
          modelAnswer: dto.modelAnswer,
        },
      });
    });
  }
}
