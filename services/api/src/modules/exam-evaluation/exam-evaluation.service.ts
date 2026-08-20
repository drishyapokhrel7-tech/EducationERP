import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AttendanceStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RecordExamAttemptDto } from "./dto/record-exam-attempt.dto";
import { RecordMarksDto } from "./dto/record-marks.dto";

/** Same FK-vs-RLS parent-guard pattern as every prior slice's service. */
@Injectable()
export class ExamEvaluationService {
  constructor(private readonly prisma: PrismaService) {}

  listAttempts(organizationId: string, examSubjectId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.examAttempt.findMany({
        where: { organizationId, examSubjectId },
        include: { student: true, marks: true },
        orderBy: { createdAt: "asc" },
      }),
    );
  }

  async recordAttempt(organizationId: string, examSubjectId: string, dto: RecordExamAttemptDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const examSubject = await tx.examSubject.findUnique({ where: { id: examSubjectId } });
      if (!examSubject) throw new NotFoundException("Exam subject not found");

      const student = await tx.student.findUnique({ where: { id: dto.studentId } });
      if (!student) throw new NotFoundException("Student not found");

      // Upsert rather than a separate "correct" endpoint (3b's
      // AttendanceException pattern) — the plan doesn't call for an
      // audit trail on exam attempts specifically, so a plain
      // correction-friendly upsert is proportionate here.
      const existing = await tx.examAttempt.findUnique({
        where: { examSubjectId_studentId: { examSubjectId, studentId: dto.studentId } },
      });
      if (existing) {
        return tx.examAttempt.update({ where: { id: existing.id }, data: { status: dto.status } });
      }
      return tx.examAttempt.create({
        data: { organizationId, examSubjectId, studentId: dto.studentId, status: dto.status },
      });
    });
  }

  async recordMarks(organizationId: string, examAttemptId: string, dto: RecordMarksDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const attempt = await tx.examAttempt.findUnique({
        where: { id: examAttemptId },
        include: { examSubject: true },
      });
      if (!attempt) throw new NotFoundException("Exam attempt not found");

      if (attempt.status === AttendanceStatus.ABSENT || attempt.status === AttendanceStatus.EXCUSED) {
        throw new BadRequestException("Cannot record marks for a student who did not sit the exam");
      }

      if (dto.obtainedMarks > attempt.examSubject.fullMarks) {
        throw new BadRequestException(`obtainedMarks cannot exceed fullMarks (${attempt.examSubject.fullMarks})`);
      }

      const existing = await tx.marks.findUnique({ where: { examAttemptId } });
      if (existing) {
        return tx.marks.update({
          where: { id: existing.id },
          data: { obtainedMarks: dto.obtainedMarks, remarks: dto.remarks },
        });
      }
      return tx.marks.create({
        data: { organizationId, examAttemptId, obtainedMarks: dto.obtainedMarks, remarks: dto.remarks },
      });
    });
  }
}
