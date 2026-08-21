import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateExamDto } from "./dto/create-exam.dto";
import { CreateExamSubjectDto } from "./dto/create-exam-subject.dto";
import { CreateExamScheduleDto } from "./dto/create-exam-schedule.dto";
import { CreateExamRoomDto } from "./dto/create-exam-room.dto";

/** Same FK-vs-RLS parent-guard pattern as every prior slice's service. */
@Injectable()
export class ExamSchedulingService {
  constructor(private readonly prisma: PrismaService) {}

  listExams(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.exam.findMany({
        where: { organizationId },
        include: { examType: true, term: true, gradingScheme: true },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  async createExam(organizationId: string, dto: CreateExamDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const examType = await tx.examType.findUnique({ where: { id: dto.examTypeId } });
      if (!examType) throw new NotFoundException("Exam type not found");

      const term = await tx.term.findUnique({ where: { id: dto.termId } });
      if (!term) throw new NotFoundException("Term not found");

      if (dto.gradingSchemeId) {
        const gradingScheme = await tx.gradingScheme.findUnique({ where: { id: dto.gradingSchemeId } });
        if (!gradingScheme) throw new NotFoundException("Grading scheme not found");
      }

      return tx.exam.create({
        data: {
          organizationId,
          examTypeId: dto.examTypeId,
          termId: dto.termId,
          name: dto.name,
          gradingSchemeId: dto.gradingSchemeId,
        },
      });
    });
  }

  async getExam(organizationId: string, examId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const exam = await tx.exam.findUnique({
        where: { id: examId },
        include: { examType: true, term: true, gradingScheme: true },
      });
      if (!exam) throw new NotFoundException("Exam not found");

      const examSubjects = await tx.examSubject.findMany({
        where: { organizationId, examId },
        include: {
          curriculumSubject: { include: { subject: true } },
          examSchedule: { include: { examRooms: { include: { room: true } } } },
        },
        orderBy: { createdAt: "asc" },
      });
      return { ...exam, examSubjects };
    });
  }

  async addExamSubject(organizationId: string, examId: string, dto: CreateExamSubjectDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const exam = await tx.exam.findUnique({ where: { id: examId } });
      if (!exam) throw new NotFoundException("Exam not found");

      const curriculumSubject = await tx.curriculumSubject.findUnique({
        where: { id: dto.curriculumSubjectId },
      });
      if (!curriculumSubject) throw new NotFoundException("Curriculum subject not found");

      if (dto.passMarks > dto.fullMarks) {
        throw new BadRequestException("passMarks cannot exceed fullMarks");
      }

      const existing = await tx.examSubject.findUnique({
        where: { examId_curriculumSubjectId: { examId, curriculumSubjectId: dto.curriculumSubjectId } },
      });
      if (existing) throw new ConflictException("This subject is already part of this exam");

      if (dto.questionBankId) {
        const questionBank = await tx.questionBank.findUnique({ where: { id: dto.questionBankId } });
        if (!questionBank) throw new NotFoundException("Question bank not found");
        if (questionBank.curriculumSubjectId !== dto.curriculumSubjectId) {
          throw new BadRequestException("Question bank must belong to the same curriculum subject");
        }
      }

      return tx.examSubject.create({
        data: {
          organizationId,
          examId,
          curriculumSubjectId: dto.curriculumSubjectId,
          fullMarks: dto.fullMarks,
          passMarks: dto.passMarks,
          questionBankId: dto.questionBankId,
        },
      });
    });
  }

  async createExamSchedule(organizationId: string, examSubjectId: string, dto: CreateExamScheduleDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const examSubject = await tx.examSubject.findUnique({ where: { id: examSubjectId } });
      if (!examSubject) throw new NotFoundException("Exam subject not found");

      if (dto.startTime >= dto.endTime) {
        throw new BadRequestException("startTime must be before endTime");
      }

      const existing = await tx.examSchedule.findUnique({ where: { examSubjectId } });
      if (existing) throw new ConflictException("This exam subject already has a schedule");

      return tx.examSchedule.create({
        data: {
          organizationId,
          examSubjectId,
          date: new Date(dto.date),
          startTime: dto.startTime,
          endTime: dto.endTime,
        },
      });
    });
  }

  async addExamRoom(organizationId: string, examScheduleId: string, dto: CreateExamRoomDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const schedule = await tx.examSchedule.findUnique({ where: { id: examScheduleId } });
      if (!schedule) throw new NotFoundException("Exam schedule not found");

      const room = await tx.room.findUnique({ where: { id: dto.roomId } });
      if (!room) throw new NotFoundException("Room not found");

      const existing = await tx.examRoom.findUnique({
        where: { examScheduleId_roomId: { examScheduleId, roomId: dto.roomId } },
      });
      if (existing) throw new ConflictException("This room is already assigned to this exam schedule");

      // The same room can't host two overlapping exam sittings on the
      // same date, even across different exam schedules — a real
      // time-range overlap, so unlike 3a's exact-tuple ClassSchedule
      // constraints this can't be expressed as a flat @@unique index
      // and is checked here instead.
      const sameRoomBookings = await tx.examRoom.findMany({
        where: { organizationId, roomId: dto.roomId, examSchedule: { date: schedule.date } },
        include: { examSchedule: true },
      });
      const overlaps = sameRoomBookings.some(
        (booking) =>
          booking.examSchedule.startTime < schedule.endTime && booking.examSchedule.endTime > schedule.startTime,
      );
      if (overlaps) throw new ConflictException("This room is already booked for an overlapping exam time");

      return tx.examRoom.create({
        data: { organizationId, examScheduleId, roomId: dto.roomId, capacity: dto.capacity },
      });
    });
  }
}
