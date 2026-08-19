import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { SyllabusNodeLevel } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateSyllabusDto } from "./dto/create-syllabus.dto";
import { CreateSyllabusNodeDto } from "./dto/create-syllabus-node.dto";
import { CreateLearningObjectiveDto } from "./dto/create-learning-objective.dto";
import { CreateLessonPlanDto } from "./dto/create-lesson-plan.dto";

// Index in this array = required parent level (UNIT has none). Same
// FK-vs-RLS parent-guard philosophy applied to the node tree's own
// shape: the four levels are a property of the workflow (plan §8), so
// enforcing this ordering keeps the tree meaningful without hard-coding
// any institution-specific taxonomy on top of it.
const LEVEL_ORDER: SyllabusNodeLevel[] = ["UNIT", "CHAPTER", "TOPIC", "SUBTOPIC"];

/** Same FK-vs-RLS parent-guard pattern as every prior slice's service. */
@Injectable()
export class SyllabusService {
  constructor(private readonly prisma: PrismaService) {}

  listSyllabi(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.syllabus.findMany({
        where: { organizationId },
        include: { curriculumSubject: { include: { subject: true, curriculum: true } }, term: true },
      }),
    );
  }

  async createSyllabus(organizationId: string, dto: CreateSyllabusDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const [curriculumSubject, term] = await Promise.all([
        tx.curriculumSubject.findUnique({ where: { id: dto.curriculumSubjectId } }),
        tx.term.findUnique({ where: { id: dto.termId } }),
      ]);
      if (!curriculumSubject) throw new NotFoundException("Curriculum subject not found");
      if (!term) throw new NotFoundException("Term not found");

      const existing = await tx.syllabus.findUnique({
        where: { curriculumSubjectId_termId: { curriculumSubjectId: dto.curriculumSubjectId, termId: dto.termId } },
      });
      if (existing) {
        throw new ConflictException("A syllabus for this curriculum subject and term already exists");
      }

      return tx.syllabus.create({
        data: {
          organizationId,
          curriculumSubjectId: dto.curriculumSubjectId,
          termId: dto.termId,
          name: dto.name,
          description: dto.description,
        },
      });
    });
  }

  async getSyllabus(organizationId: string, syllabusId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const syllabus = await tx.syllabus.findUnique({
        where: { id: syllabusId },
        include: { curriculumSubject: { include: { subject: true, curriculum: true } }, term: true },
      });
      if (!syllabus) throw new NotFoundException("Syllabus not found");

      const nodes = await tx.syllabusNode.findMany({
        where: { organizationId, syllabusId },
        include: { learningObjectives: true },
        orderBy: [{ sequence: "asc" }],
      });
      return { ...syllabus, nodes };
    });
  }

  async createNode(organizationId: string, syllabusId: string, dto: CreateSyllabusNodeDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const syllabus = await tx.syllabus.findUnique({ where: { id: syllabusId } });
      if (!syllabus) throw new NotFoundException("Syllabus not found");

      const requiredParentLevelIndex = LEVEL_ORDER.indexOf(dto.level) - 1;
      if (requiredParentLevelIndex < 0) {
        if (dto.parentId) {
          throw new BadRequestException("UNIT nodes are top-level and cannot have a parent");
        }
      } else {
        if (!dto.parentId) {
          throw new BadRequestException(`${dto.level} nodes require a parent ${LEVEL_ORDER[requiredParentLevelIndex]}`);
        }
        const parent = await tx.syllabusNode.findUnique({ where: { id: dto.parentId } });
        if (!parent || parent.syllabusId !== syllabusId) {
          throw new NotFoundException("Parent node not found");
        }
        if (parent.level !== LEVEL_ORDER[requiredParentLevelIndex]) {
          throw new BadRequestException(`${dto.level} nodes require a parent ${LEVEL_ORDER[requiredParentLevelIndex]}, got ${parent.level}`);
        }
      }

      return tx.syllabusNode.create({
        data: {
          organizationId,
          syllabusId,
          parentId: dto.parentId,
          level: dto.level,
          sequence: dto.sequence,
          name: dto.name,
          description: dto.description,
        },
      });
    });
  }

  async createObjective(organizationId: string, nodeId: string, dto: CreateLearningObjectiveDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const node = await tx.syllabusNode.findUnique({ where: { id: nodeId } });
      if (!node) throw new NotFoundException("Syllabus node not found");

      return tx.learningObjective.create({
        data: {
          organizationId,
          syllabusNodeId: nodeId,
          sequence: dto.sequence,
          description: dto.description,
        },
      });
    });
  }

  listLessonPlans(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.lessonPlan.findMany({
        where: { organizationId },
        include: {
          teachingAssignment: { include: { subject: true, section: true, employee: true } },
          syllabusNode: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  async createLessonPlan(organizationId: string, dto: CreateLessonPlanDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const [teachingAssignment, syllabusNode] = await Promise.all([
        tx.teachingAssignment.findUnique({ where: { id: dto.teachingAssignmentId } }),
        tx.syllabusNode.findUnique({ where: { id: dto.syllabusNodeId } }),
      ]);
      if (!teachingAssignment) throw new NotFoundException("Teaching assignment not found");
      if (!syllabusNode) throw new NotFoundException("Syllabus node not found");

      return tx.lessonPlan.create({
        data: {
          organizationId,
          teachingAssignmentId: dto.teachingAssignmentId,
          syllabusNodeId: dto.syllabusNodeId,
          title: dto.title,
          objectives: dto.objectives,
          materials: dto.materials,
          plannedDate: dto.plannedDate ? new Date(dto.plannedDate) : undefined,
          notes: dto.notes,
        },
      });
    });
  }
}
