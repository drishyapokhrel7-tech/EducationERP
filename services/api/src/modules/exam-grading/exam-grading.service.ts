import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

interface GradeBand {
  minPercentage: number;
  maxPercentage: number;
  grade: string;
  gpa?: number;
  remarks?: string;
}

function matchBand(bands: GradeBand[], percentage: number): GradeBand {
  const match = bands.find((b) => percentage >= b.minPercentage && percentage <= b.maxPercentage);
  if (!match) {
    throw new BadRequestException(
      `No grading scheme band covers ${percentage.toFixed(2)}% — check the scheme's bands cover the full range`,
    );
  }
  return match;
}

/** Same FK-vs-RLS parent-guard pattern as every prior slice's service. */
@Injectable()
export class ExamGradingService {
  constructor(private readonly prisma: PrismaService) {}

  async computeGrade(organizationId: string, examAttemptId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const attempt = await tx.examAttempt.findUnique({
        where: { id: examAttemptId },
        include: { examSubject: { include: { exam: { include: { gradingScheme: true } } } }, marks: true },
      });
      if (!attempt) throw new NotFoundException("Exam attempt not found");
      if (!attempt.marks) throw new BadRequestException("Marks must be recorded before a grade can be computed");
      if (!attempt.examSubject.exam.gradingScheme) {
        throw new BadRequestException("This exam has no grading scheme assigned");
      }

      const percentage = (attempt.marks.obtainedMarks / attempt.examSubject.fullMarks) * 100;
      const bands = attempt.examSubject.exam.gradingScheme.bands as unknown as GradeBand[];
      const band = matchBand(bands, percentage);
      const data = { percentage, grade: band.grade, gpa: band.gpa ?? null };

      const existing = await tx.grade.findUnique({ where: { examAttemptId } });
      if (existing) return tx.grade.update({ where: { id: existing.id }, data });
      return tx.grade.create({ data: { organizationId, examAttemptId, ...data } });
    });
  }

  async generateReportCard(organizationId: string, examId: string, studentId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const exam = await tx.exam.findUnique({ where: { id: examId }, include: { gradingScheme: true } });
      if (!exam) throw new NotFoundException("Exam not found");
      if (!exam.gradingScheme) throw new BadRequestException("This exam has no grading scheme assigned");

      const student = await tx.student.findUnique({ where: { id: studentId } });
      if (!student) throw new NotFoundException("Student not found");

      const attempts = await tx.examAttempt.findMany({
        where: { organizationId, studentId, examSubject: { examId } },
        include: { examSubject: true, marks: true, grade: true },
      });
      const graded = attempts.filter((a) => a.marks && a.grade);
      if (graded.length === 0) {
        throw new BadRequestException("No graded exam subjects found for this student in this exam");
      }

      const totalObtainedMarks = graded.reduce((sum, a) => sum + a.marks!.obtainedMarks, 0);
      const totalFullMarks = graded.reduce((sum, a) => sum + a.examSubject.fullMarks, 0);
      const percentage = (totalObtainedMarks / totalFullMarks) * 100;
      const bands = exam.gradingScheme.bands as unknown as GradeBand[];
      const band = matchBand(bands, percentage);
      const data = {
        totalObtainedMarks,
        totalFullMarks,
        percentage,
        overallGrade: band.grade,
        overallGpa: band.gpa ?? null,
      };

      const existing = await tx.reportCard.findUnique({ where: { examId_studentId: { examId, studentId } } });
      if (existing) return tx.reportCard.update({ where: { id: existing.id }, data });
      return tx.reportCard.create({ data: { organizationId, examId, studentId, ...data } });
    });
  }

  async getReportCard(organizationId: string, examId: string, studentId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const reportCard = await tx.reportCard.findUnique({ where: { examId_studentId: { examId, studentId } } });
      if (!reportCard) throw new NotFoundException("Report card not found");

      // The per-subject breakdown is derived here, not stored on
      // ReportCard itself — see the schema comment on why.
      const attempts = await tx.examAttempt.findMany({
        where: { organizationId, studentId, examSubject: { examId } },
        include: {
          examSubject: { include: { curriculumSubject: { include: { subject: true } } } },
          marks: true,
          grade: true,
        },
      });

      return { ...reportCard, subjects: attempts.filter((a) => a.marks && a.grade) };
    });
  }
}
