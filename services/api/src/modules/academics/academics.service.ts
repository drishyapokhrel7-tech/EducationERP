import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateSubjectDto } from "./dto/create-subject.dto";
import { UpdateSubjectDto } from "./dto/update-subject.dto";
import { CreateCurriculumDto } from "./dto/create-curriculum.dto";
import { UpdateCurriculumDto } from "./dto/update-curriculum.dto";
import { AttachCurriculumSubjectDto } from "./dto/attach-curriculum-subject.dto";
import { assertNoDependents } from "../../common/assert-no-dependents";

/** Same load-bearing parent-guard pattern as every prior slice's service. */
@Injectable()
export class AcademicsService {
  constructor(private readonly prisma: PrismaService) {}

  listSubjects(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.subject.findMany({ where: { organizationId } }),
    );
  }

  createSubject(organizationId: string, dto: CreateSubjectDto) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.subject.create({ data: { organizationId, name: dto.name, code: dto.code } }),
    );
  }

  async updateSubject(organizationId: string, id: string, dto: UpdateSubjectDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadSubject(tx, organizationId, id);
      return tx.subject.update({ where: { id }, data: dto });
    });
  }

  async deleteSubject(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadSubject(tx, organizationId, id);
      await assertNoDependents(
        [
          tx.curriculumSubject.count({ where: { subjectId: id } }),
          tx.teachingAssignment.count({ where: { subjectId: id } }),
        ],
        "subject",
      );
      await tx.subject.delete({ where: { id } });
      return { deleted: true };
    });
  }

  private async loadSubject(tx: PrismaClient, organizationId: string, id: string) {
    const subject = await tx.subject.findUnique({ where: { id } });
    if (!subject || subject.organizationId !== organizationId) throw new NotFoundException("Subject not found");
    return subject;
  }

  listCurricula(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.curriculum.findMany({
        where: { organizationId },
        include: { subjects: { include: { subject: true } } },
      }),
    );
  }

  async createCurriculum(organizationId: string, dto: CreateCurriculumDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const program = await tx.program.findUnique({ where: { id: dto.programId } });
      if (!program) {
        throw new NotFoundException("Program not found");
      }
      return tx.curriculum.create({
        data: { organizationId, programId: dto.programId, name: dto.name, code: dto.code },
      });
    });
  }

  async updateCurriculum(organizationId: string, id: string, dto: UpdateCurriculumDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadCurriculum(tx, organizationId, id);
      if (dto.programId) {
        const program = await tx.program.findUnique({ where: { id: dto.programId } });
        if (!program) throw new NotFoundException("Program not found");
      }
      return tx.curriculum.update({
        where: { id },
        data: { programId: dto.programId, name: dto.name, code: dto.code },
      });
    });
  }

  async deleteCurriculum(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadCurriculum(tx, organizationId, id);
      await assertNoDependents([tx.curriculumSubject.count({ where: { curriculumId: id } })], "curriculum");
      await tx.curriculum.delete({ where: { id } });
      return { deleted: true };
    });
  }

  private async loadCurriculum(tx: PrismaClient, organizationId: string, id: string) {
    const curriculum = await tx.curriculum.findUnique({ where: { id } });
    if (!curriculum || curriculum.organizationId !== organizationId) throw new NotFoundException("Curriculum not found");
    return curriculum;
  }

  async attachSubject(organizationId: string, curriculumId: string, dto: AttachCurriculumSubjectDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const [curriculum, subject] = await Promise.all([
        tx.curriculum.findUnique({ where: { id: curriculumId } }),
        tx.subject.findUnique({ where: { id: dto.subjectId } }),
      ]);
      if (!curriculum) throw new NotFoundException("Curriculum not found");
      if (!subject) throw new NotFoundException("Subject not found");

      return tx.curriculumSubject.create({
        data: {
          organizationId,
          curriculumId,
          subjectId: dto.subjectId,
          isCompulsory: dto.isCompulsory ?? true,
        },
      });
    });
  }
}
