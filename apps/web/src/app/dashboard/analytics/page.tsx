"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/submit-action";
import { toLocalDateString } from "@/lib/local-date";

async function downloadFile(fetchBlob: () => Promise<Blob>, filename: string) {
  try {
    const blob = await fetchBlob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    toast.error(errorMessage(err, "Export failed"));
  }
}

function ExportButtons({ onCsv, onXlsx, onPdf }: { onCsv: () => void; onXlsx: () => void; onPdf: () => void }) {
  return (
    <div className="flex gap-2">
      <Button type="button" size="sm" variant="outline" onClick={onCsv}>
        Export CSV
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={onXlsx}>
        Export Excel
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={onPdf}>
        Export PDF
      </Button>
    </div>
  );
}

const NPR = new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 });

export default function AnalyticsPage() {
  const operational = useSWR("analytics-operational", () => api.getOperationalAnalytics());
  const academic = useSWR("analytics-academic", () => api.getAcademicAnalytics());
  const enrollment = useSWR("analytics-enrollment", () => api.getEnrollmentAnalytics());

  const today = new Date();
  const defaultFrom = toLocalDateString(new Date(today.getFullYear(), today.getMonth(), 1));
  const defaultTo = toLocalDateString(new Date(today.getFullYear(), today.getMonth() + 1, 0));
  const [dateRange, setDateRange] = useState({ from: defaultFrom, to: defaultTo });
  const attendance = useSWR(["analytics-attendance", dateRange.from, dateRange.to], () =>
    api.getAttendanceAnalytics(dateRange.from, dateRange.to),
  );
  const financial = useSWR("analytics-financial", () => api.getFinancialAnalytics());
  const examination = useSWR("analytics-examination", () => api.getExaminationAnalytics());
  const continuousLearning = useSWR("analytics-continuous-learning", () => api.getContinuousLearningAnalytics());
  const alumniOutcomes = useSWR("analytics-alumni-outcomes", () => api.getAlumniOutcomesAnalytics());

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Analytics &amp; Reports</h1>
        <p className="text-muted-foreground text-sm">
          Institution-wide aggregate reporting, computed live from current data. Every card can be exported as CSV, Excel,
          or PDF.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Operational</CardTitle>
          <ExportButtons
            onCsv={() => downloadFile(() => api.exportOperationalAnalytics("csv"), "operational.csv")}
            onXlsx={() => downloadFile(() => api.exportOperationalAnalytics("xlsx"), "operational.xlsx")}
            onPdf={() => downloadFile(() => api.exportOperationalAnalytics("pdf"), "operational.pdf")}
          />
        </CardHeader>
        <CardContent>
          {!operational.data ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-muted-foreground text-xs">Active students</p>
                <p className="text-2xl font-semibold">{operational.data.activeStudents}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Active staff</p>
                <p className="text-2xl font-semibold">{operational.data.activeStaff}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Active enrollments</p>
                <p className="text-2xl font-semibold">{operational.data.activeEnrollments}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Outstanding invoices</p>
                <p className="text-2xl font-semibold">{NPR.format(operational.data.outstandingAmount)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Academic</CardTitle>
          <ExportButtons
            onCsv={() => downloadFile(() => api.exportAcademicAnalytics("csv"), "academic.csv")}
            onXlsx={() => downloadFile(() => api.exportAcademicAnalytics("xlsx"), "academic.xlsx")}
            onPdf={() => downloadFile(() => api.exportAcademicAnalytics("pdf"), "academic.pdf")}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {!academic.data ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <>
              <div>
                <p className="mb-1 text-xs font-medium">Active enrollment by program</p>
                {academic.data.enrollmentByProgram.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No active enrollments yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {academic.data.enrollmentByProgram.map((p) => (
                      <Badge key={p.name} variant="outline">
                        {p.name}: {p.count}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="mb-1 text-xs font-medium">Active enrollment by section</p>
                {academic.data.enrollmentBySection.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No active enrollments yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {academic.data.enrollmentBySection.map((s) => (
                      <Badge key={s.name} variant="outline">
                        {s.name}: {s.count}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="mb-1 text-xs font-medium">
                  Grade distribution{academic.data.gradeDistribution.examName ? ` — ${academic.data.gradeDistribution.examName}` : ""}
                </p>
                {academic.data.gradeDistribution.bands.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No computed grades yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {academic.data.gradeDistribution.bands.map((b) => (
                      <Badge key={b.grade} variant="secondary">
                        {b.grade}: {b.count}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Attendance</CardTitle>
          <ExportButtons
            onCsv={() =>
              downloadFile(() => api.exportAttendanceAnalytics("csv", dateRange.from, dateRange.to), "attendance.csv")
            }
            onXlsx={() =>
              downloadFile(() => api.exportAttendanceAnalytics("xlsx", dateRange.from, dateRange.to), "attendance.xlsx")
            }
            onPdf={() =>
              downloadFile(() => api.exportAttendanceAnalytics("pdf", dateRange.from, dateRange.to), "attendance.pdf")
            }
          />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input
                className="h-8 w-36"
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange((r) => ({ ...r, from: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input
                className="h-8 w-36"
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange((r) => ({ ...r, to: e.target.value }))}
              />
            </div>
          </div>
          {!attendance.data ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <>
              <p className="text-sm">
                Overall attendance rate: <span className="font-semibold">{attendance.data.overallRate ?? "—"}%</span>{" "}
                <span className="text-muted-foreground">({attendance.data.totalMarked} records marked)</span>
              </p>
              {attendance.data.bySection.length === 0 ? (
                <p className="text-muted-foreground text-sm">No attendance records in this range.</p>
              ) : (
                <ul className="text-sm">
                  {attendance.data.bySection.map((s) => (
                    <li key={s.name}>
                      {s.name}: {s.rate ?? "—"}% ({s.present}/{s.total})
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Enrollment</CardTitle>
          <ExportButtons
            onCsv={() => downloadFile(() => api.exportEnrollmentAnalytics("csv"), "enrollment.csv")}
            onXlsx={() => downloadFile(() => api.exportEnrollmentAnalytics("xlsx"), "enrollment.xlsx")}
            onPdf={() => downloadFile(() => api.exportEnrollmentAnalytics("pdf"), "enrollment.pdf")}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {!enrollment.data ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <>
              <div>
                <p className="mb-1 text-xs font-medium">Admissions funnel</p>
                {enrollment.data.admissionsFunnel.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No admission applications yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {enrollment.data.admissionsFunnel.map((f) => (
                      <Badge key={f.status} variant="outline">
                        {f.status}: {f.count}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="mb-1 text-xs font-medium">Enrollment trend by academic year</p>
                {enrollment.data.enrollmentTrend.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No active enrollments yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {enrollment.data.enrollmentTrend.map((t) => (
                      <Badge key={t.academicYear} variant="secondary">
                        {t.academicYear}: {t.count}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Financial</CardTitle>
          <ExportButtons
            onCsv={() => downloadFile(() => api.exportFinancialAnalytics("csv"), "financial.csv")}
            onXlsx={() => downloadFile(() => api.exportFinancialAnalytics("xlsx"), "financial.xlsx")}
            onPdf={() => downloadFile(() => api.exportFinancialAnalytics("pdf"), "financial.pdf")}
          />
        </CardHeader>
        <CardContent className="space-y-3">
          {!financial.data ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-muted-foreground text-xs">Total invoiced</p>
                  <p className="text-xl font-semibold">{NPR.format(financial.data.totalInvoiced)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Total collected</p>
                  <p className="text-xl font-semibold">{NPR.format(financial.data.totalCollected)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Total discounted</p>
                  <p className="text-xl font-semibold">{NPR.format(financial.data.totalDiscounted)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Total outstanding</p>
                  <p className="text-xl font-semibold">{NPR.format(financial.data.totalOutstanding)}</p>
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium">Collections by payment method</p>
                {financial.data.collectionsByMethod.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No payments recorded yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {financial.data.collectionsByMethod.map((m) => (
                      <Badge key={m.method} variant="outline">
                        {m.method}: {NPR.format(m.amount)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Examination</CardTitle>
          <ExportButtons
            onCsv={() => downloadFile(() => api.exportExaminationAnalytics("csv"), "examination.csv")}
            onXlsx={() => downloadFile(() => api.exportExaminationAnalytics("xlsx"), "examination.xlsx")}
            onPdf={() => downloadFile(() => api.exportExaminationAnalytics("pdf"), "examination.pdf")}
          />
        </CardHeader>
        <CardContent className="space-y-3">
          {!examination.data ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-muted-foreground text-xs">Attempts scored</p>
                  <p className="text-2xl font-semibold">{examination.data.attemptsScored}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Pass rate</p>
                  <p className="text-2xl font-semibold">{examination.data.passRate ?? "—"}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Average percentage</p>
                  <p className="text-2xl font-semibold">{examination.data.averagePercentage ?? "—"}%</p>
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium">Grade distribution (all exams)</p>
                {examination.data.gradeDistribution.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No computed grades yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {examination.data.gradeDistribution.map((g) => (
                      <Badge key={g.grade} variant="secondary">
                        {g.grade}: {g.count}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Continuous learning</CardTitle>
          <ExportButtons
            onCsv={() => downloadFile(() => api.exportContinuousLearningAnalytics("csv"), "continuous-learning.csv")}
            onXlsx={() => downloadFile(() => api.exportContinuousLearningAnalytics("xlsx"), "continuous-learning.xlsx")}
            onPdf={() => downloadFile(() => api.exportContinuousLearningAnalytics("pdf"), "continuous-learning.pdf")}
          />
        </CardHeader>
        <CardContent>
          {!continuousLearning.data ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-muted-foreground text-xs">Assignment submissions</p>
                <p className="text-2xl font-semibold">{continuousLearning.data.totalSubmissions}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Graded rate</p>
                <p className="text-2xl font-semibold">{continuousLearning.data.submissionGradedRate ?? "—"}%</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Quiz attempts</p>
                <p className="text-2xl font-semibold">{continuousLearning.data.totalQuizAttempts}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Average quiz score</p>
                <p className="text-2xl font-semibold">{continuousLearning.data.averageQuizScore ?? "—"}%</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Alumni &amp; graduate outcomes</CardTitle>
          <ExportButtons
            onCsv={() => downloadFile(() => api.exportAlumniOutcomesAnalytics("csv"), "alumni-outcomes.csv")}
            onXlsx={() => downloadFile(() => api.exportAlumniOutcomesAnalytics("xlsx"), "alumni-outcomes.xlsx")}
            onPdf={() => downloadFile(() => api.exportAlumniOutcomesAnalytics("pdf"), "alumni-outcomes.pdf")}
          />
        </CardHeader>
        <CardContent className="space-y-3">
          {!alumniOutcomes.data ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground text-xs">Total alumni</p>
                  <p className="text-2xl font-semibold">{alumniOutcomes.data.totalAlumni}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Outcomes recorded</p>
                  <p className="text-2xl font-semibold">{alumniOutcomes.data.outcomesRecorded}</p>
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium">Employment status</p>
                {alumniOutcomes.data.employmentStatus.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No outcomes recorded yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {alumniOutcomes.data.employmentStatus.map((s) => (
                      <Badge key={s.status} variant="outline">
                        {s.status}: {s.count}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
