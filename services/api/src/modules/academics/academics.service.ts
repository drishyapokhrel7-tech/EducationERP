import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateSubjectDto } from "./dto/create-subject.dto";
import { CreateCurriculumDto } from "./dto/create-curriculum.dto";
import { AttachCurriculumSubjectDto } from "./dto/attach-curriculum-subject.dto";

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
