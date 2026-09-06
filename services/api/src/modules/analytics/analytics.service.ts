import { Injectable } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Pure read-only aggregation over data every prior phase already
 * built — no new tables (the first slice this session with none).
 * Deliberately computed live on every request, not cached or
 * materialized: at this project's data volumes (a single small-to-
 * mid institution) these are sub-second queries, and introducing a
 * materialized-view refresh schedule or a background job for numbers
 * this cheap to compute would be speculative complexity ahead of any
 * real need — revisit only if a future slice's real usage shows a
 * query actually straining.
 *
 * Unlike `DashboardsService` (Phase 3f, per-individual "what would
 * this teacher/student/parent see"), every method here is an
 * institution-wide aggregate for an admin/principal — a genuinely
 * different, previously-unbuilt capability, not a duplicate.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Operational ────────────────────────────────────────────────────

  async operational(organizationId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const [activeStudents, activeStaff, activeEnrollments, invoices] = await Promise.all([
        tx.student.count({ where: { organizationId, status: "ACTIVE" } }),
        tx.employee.count({ where: { organizationId, status: "ACTIVE" } }),
        tx.studentEnrollment.count({ where: { organizationId, status: "ACTIVE" } }),
        tx.invoice.findMany({
          where: { organizationId, status: { not: "CANCELLED" } },
          include: { discounts: true, payments: { include: { refunds: true } } },
        }),
      ]);

      // Same netPayable/netPaid formula finance.service.ts's own
      // recomputeInvoiceStatus uses — reused, not reinvented.
      const outstandingAmount = invoices.reduce((sum, invoice) => {
        const netPayable = toNumber(invoice.totalAmount) - invoice.discounts.reduce((s, d) => s + toNumber(d.amount), 0);
        const netPaid = invoice.payments.reduce((s, p) => {
          const refunded = p.refunds.reduce((rs, r) => rs + toNumber(r.amount), 0);
          return s + toNumber(p.amount) - refunded;
        }, 0);
        return sum + Math.max(0, netPayable - netPaid);
      }, 0);

      return { activeStudents, activeStaff, activeEnrollments, outstandingAmount };
    });
  }

  // ── Academic ────────────────────────────────────────────────────────

  async academic(organizationId: string, examId?: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const enrollments = await tx.studentEnrollment.findMany({
        where: { organizationId, status: "ACTIVE" },
        include: { program: true, section: true },
      });

      const byProgram = new Map<string, number>();
      const bySection = new Map<string, number>();
      for (const e of enrollments) {
        byProgram.set(e.program.name, (byProgram.get(e.program.name) ?? 0) + 1);
        bySection.set(e.section.name, (bySection.get(e.section.name) ?? 0) + 1);
      }

      const resolvedExamId = examId ?? (await this.mostRecentGradedExamId(tx, organizationId));
      let gradeDistribution: { grade: string; count: number }[] = [];
      let examName: string | null = null;
      if (resolvedExamId) {
        const exam = await tx.exam.findUnique({ where: { id: resolvedExamId } });
        examName = exam?.name ?? null;
        const grades = await tx.grade.findMany({
          where: { organizationId, examAttempt: { examSubject: { examId: resolvedExamId } } },
        });
        const byGrade = new Map<string, number>();
        for (const g of grades) byGrade.set(g.grade, (byGrade.get(g.grade) ?? 0) + 1);
        gradeDistribution = Array.from(byGrade.entries()).map(([grade, count]) => ({ grade, count }));
      }

      return {
        enrollmentByProgram: Array.from(byProgram.entries()).map(([name, count]) => ({ name, count })),
        enrollmentBySection: Array.from(bySection.entries()).map(([name, count]) => ({ name, count })),
        gradeDistribution: { examId: resolvedExamId, examName, bands: gradeDistribution },
      };
    });
  }

  private async mostRecentGradedExamId(tx: PrismaClient, organizationId: string) {
    const latest = await tx.grade.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: { examAttempt: { include: { examSubject: true } } },
    });
    return latest?.examAttempt.examSubject.examId ?? null;
  }

  // ── Attendance ──────────────────────────────────────────────────────

  async attendance(organizationId: string, from?: string, to?: string) {
    const { start, end } = resolveDateRange(from, to);
    return this.prisma.withTenant(organizationId, async (tx) => {
      const records = await tx.studentAttendance.findMany({
        where: { organizationId, session: { date: { gte: start, lte: end } } },
        include: { session: { include: { section: true } } },
      });

      const bySection = new Map<string, { present: number; total: number }>();
      for (const r of records) {
        const key = r.session.section.name;
        const bucket = bySection.get(key) ?? { present: 0, total: 0 };
        bucket.total += 1;
        if (r.status === "PRESENT" || r.status === "LATE") bucket.present += 1;
        bySection.set(key, bucket);
      }

      const totalPresent = records.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
      const overallRate = records.length === 0 ? null : Math.round((totalPresent / records.length) * 1000) / 10;

      return {
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
        overallRate,
        totalMarked: records.length,
        bySection: Array.from(bySection.entries()).map(([name, { present, total }]) => ({
          name,
          rate: total === 0 ? null : Math.round((present / total) * 1000) / 10,
          present,
          total,
        })),
      };
    });
  }

  // ── Enrollment ──────────────────────────────────────────────────────

  async enrollment(organizationId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const [applications, enrollments] = await Promise.all([
        tx.admissionApplication.findMany({ where: { organizationId } }),
        tx.studentEnrollment.findMany({
          where: { organizationId, status: "ACTIVE" },
          include: { semester: { include: { academicYear: true } } },
        }),
      ]);

      const byStatus = new Map<string, number>();
      for (const a of applications) byStatus.set(a.status, (byStatus.get(a.status) ?? 0) + 1);

      const byYear = new Map<string, number>();
      for (const e of enrollments) {
        const key = e.semester.academicYear.name;
        byYear.set(key, (byYear.get(key) ?? 0) + 1);
      }

      return {
        admissionsFunnel: Array.from(byStatus.entries()).map(([status, count]) => ({ status, count })),
        enrollmentTrend: Array.from(byYear.entries()).map(([academicYear, count]) => ({ academicYear, count })),
      };
    });
  }

  // ── Financial (Phase 8 slice 8d, part 2) ──────────────────────────

  async financial(organizationId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const invoices = await tx.invoice.findMany({
        where: { organizationId, status: { not: "CANCELLED" } },
        include: {
          discounts: true,
          payments: { include: { refunds: true } },
        },
      });

      let totalInvoiced = 0;
      let totalCollected = 0;
      let totalDiscounted = 0;
      const byMethod = new Map<string, number>();
      for (const invoice of invoices) {
        totalInvoiced += toNumber(invoice.totalAmount);
        totalDiscounted += invoice.discounts.reduce((s, d) => s + toNumber(d.amount), 0);
        for (const p of invoice.payments) {
          const refunded = p.refunds.reduce((rs, r) => rs + toNumber(r.amount), 0);
          const net = toNumber(p.amount) - refunded;
          totalCollected += net;
          byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + net);
        }
      }

      return {
        totalInvoiced: Math.round(totalInvoiced * 100) / 100,
        totalCollected: Math.round(totalCollected * 100) / 100,
        totalDiscounted: Math.round(totalDiscounted * 100) / 100,
        totalOutstanding: Math.round((totalInvoiced - totalDiscounted - totalCollected) * 100) / 100,
        collectionsByMethod: Array.from(byMethod.entries()).map(([method, amount]) => ({
          method,
          amount: Math.round(amount * 100) / 100,
        })),
      };
    });
  }

  // ── Examination ────────────────────────────────────────────────────

  async examination(organizationId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const [attempts, grades] = await Promise.all([
        tx.examAttempt.findMany({
          where: { organizationId, status: "PRESENT" },
          include: { marks: true, examSubject: true },
        }),
        tx.grade.findMany({ where: { organizationId } }),
      ]);

      const scored = attempts.filter((a) => a.marks);
      const passed = scored.filter((a) => a.marks!.obtainedMarks >= a.examSubject.passMarks);
      const passRate = scored.length === 0 ? null : Math.round((passed.length / scored.length) * 1000) / 10;
      const averagePercentage =
        grades.length === 0 ? null : Math.round((grades.reduce((s, g) => s + g.percentage, 0) / grades.length) * 10) / 10;

      const byGrade = new Map<string, number>();
      for (const g of grades) byGrade.set(g.grade, (byGrade.get(g.grade) ?? 0) + 1);

      return {
        attemptsScored: scored.length,
        passRate,
        averagePercentage,
        gradeDistribution: Array.from(byGrade.entries()).map(([grade, count]) => ({ grade, count })),
      };
    });
  }

  // ── Continuous learning ────────────────────────────────────────────

  async continuousLearning(organizationId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const [submissions, quizAttempts] = await Promise.all([
        tx.assignmentSubmission.findMany({ where: { organizationId } }),
        tx.knowledgeCheckAttempt.findMany({ where: { organizationId, submittedAt: { not: null } } }),
      ]);

      const gradedSubmissions = submissions.filter((s) => s.status === "GRADED");
      const submissionGradedRate =
        submissions.length === 0 ? null : Math.round((gradedSubmissions.length / submissions.length) * 1000) / 10;

      const scoredQuizzes = quizAttempts.filter((a) => a.score !== null);
      const averageQuizScore =
        scoredQuizzes.length === 0
          ? null
          : Math.round((scoredQuizzes.reduce((s, a) => s + (a.score ?? 0), 0) / scoredQuizzes.length) * 10) / 10;

      return {
        totalSubmissions: submissions.length,
        gradedSubmissions: gradedSubmissions.length,
        submissionGradedRate,
        totalQuizAttempts: quizAttempts.length,
        averageQuizScore,
      };
    });
  }

  // ── Alumni & graduate outcomes ─────────────────────────────────────

  async alumniOutcomes(organizationId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const [totalAlumni, outcomes] = await Promise.all([
        tx.alumniProfile.count({ where: { organizationId } }),
        tx.graduateOutcome.findMany({ where: { organizationId } }),
      ]);

      const byStatus = new Map<string, number>();
      for (const o of outcomes) byStatus.set(o.employmentStatus, (byStatus.get(o.employmentStatus) ?? 0) + 1);

      return {
        totalAlumni,
        outcomesRecorded: outcomes.length,
        employmentStatus: Array.from(byStatus.entries()).map(([status, count]) => ({ status, count })),
      };
    });
  }

  // ── Export (CSV/Excel/PDF, shared) ────────────────────────────────

  async exportOperational(organizationId: string) {
    const data = await this.operational(organizationId);
    return {
      headers: ["Metric", "Value"],
      rows: [
        ["Active students", data.activeStudents],
        ["Active staff", data.activeStaff],
        ["Active enrollments", data.activeEnrollments],
        ["Outstanding invoice amount", data.outstandingAmount],
      ],
    };
  }

  async exportAcademic(organizationId: string, examId?: string) {
    const data = await this.academic(organizationId, examId);
    const rows: (string | number)[][] = [
      ...data.enrollmentByProgram.map((p) => ["Program", p.name, p.count]),
      ...data.enrollmentBySection.map((s) => ["Section", s.name, s.count]),
      ...data.gradeDistribution.bands.map((b) => ["Grade", b.grade, b.count]),
    ];
    return { headers: ["Category", "Name", "Count"], rows };
  }

  async exportAttendance(organizationId: string, from?: string, to?: string) {
    const data = await this.attendance(organizationId, from, to);
    return {
      headers: ["Section", "Present", "Total", "Rate (%)"],
      rows: data.bySection.map((s) => [s.name, s.present, s.total, s.rate ?? ""]),
    };
  }

  async exportEnrollment(organizationId: string) {
    const data = await this.enrollment(organizationId);
    const rows: (string | number)[][] = [
      ...data.admissionsFunnel.map((f) => ["Admissions", f.status, f.count]),
      ...data.enrollmentTrend.map((t) => ["Enrollment trend", t.academicYear, t.count]),
    ];
    return { headers: ["Category", "Label", "Count"], rows };
  }

  async exportFinancial(organizationId: string) {
    const data = await this.financial(organizationId);
    const rows: (string | number)[][] = [
      ["Total invoiced", data.totalInvoiced],
      ["Total collected", data.totalCollected],
      ["Total discounted", data.totalDiscounted],
      ["Total outstanding", data.totalOutstanding],
      ...data.collectionsByMethod.map((m) => [`Collected via ${m.method}`, m.amount]),
    ];
    return { headers: ["Metric", "Value"], rows };
  }

  async exportExamination(organizationId: string) {
    const data = await this.examination(organizationId);
    const rows: (string | number)[][] = [
      ["Attempts scored", data.attemptsScored],
      ["Pass rate (%)", data.passRate ?? ""],
      ["Average percentage", data.averagePercentage ?? ""],
      ...data.gradeDistribution.map((g) => [`Grade ${g.grade}`, g.count]),
    ];
    return { headers: ["Metric", "Value"], rows };
  }

  async exportContinuousLearning(organizationId: string) {
    const data = await this.continuousLearning(organizationId);
    return {
      headers: ["Metric", "Value"],
      rows: [
        ["Total submissions", data.totalSubmissions],
        ["Graded submissions", data.gradedSubmissions],
        ["Submission graded rate (%)", data.submissionGradedRate ?? ""],
        ["Total quiz attempts", data.totalQuizAttempts],
        ["Average quiz score (%)", data.averageQuizScore ?? ""],
      ],
    };
  }

  async exportAlumniOutcomes(organizationId: string) {
    const data = await this.alumniOutcomes(organizationId);
    const rows: (string | number)[][] = [
      ["Total alumni", data.totalAlumni],
      ["Outcomes recorded", data.outcomesRecorded],
      ...data.employmentStatus.map((s) => [s.status, s.count]),
    ];
    return { headers: ["Metric", "Value"], rows };
  }
}

function toNumber(value: Prisma.Decimal | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

// Defaults to the current calendar month when no range is given — same
// "sensible date default" precedent as Payroll's period params.
// Deliberately built entirely in UTC: an explicit "YYYY-MM-DD" `from`/
// `to` is always parsed as UTC midnight per the ISO date-only spec, so
// the default branch (no param given) has to construct in UTC too —
// mixing UTC parsing with local-timezone Date-constructor semantics
// for the default would silently roll the boundary back a day in any
// timezone ahead of UTC (caught for real: Nepal, UTC+5:45, showed
// "2026-07-31" as the default start of an August range).
function resolveDateRange(from?: string, to?: string) {
  const now = new Date();
  const start = from ? new Date(from) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = to ? new Date(to) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}
