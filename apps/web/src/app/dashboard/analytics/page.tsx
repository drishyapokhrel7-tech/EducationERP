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

function errorMessage(err: unknown, fallback: string) {
  const message =
    err && typeof err === "object" && "body" in err
      ? ((err as { body?: { message?: string } }).body?.message ?? null)
      : null;
  return typeof message === "string" ? message : fallback;
}

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

function ExportButtons({ onCsv, onXlsx }: { onCsv: () => void; onXlsx: () => void }) {
  return (
    <div className="flex gap-2">
      <Button type="button" size="sm" variant="outline" onClick={onCsv}>
        Export CSV
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={onXlsx}>
        Export Excel
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
  // toISOString() converts to UTC first — in a timezone ahead of UTC
  // (e.g. Nepal, UTC+5:45), local midnight on the 1st rolls back to
  // the last day of the *previous* month once converted, silently
  // showing the wrong default range. Format from local date parts
  // directly instead.
  const toLocalDateString = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const defaultFrom = toLocalDateString(new Date(today.getFullYear(), today.getMonth(), 1));
  const defaultTo = toLocalDateString(new Date(today.getFullYear(), today.getMonth() + 1, 0));
  const [dateRange, setDateRange] = useState({ from: defaultFrom, to: defaultTo });
  const attendance = useSWR(["analytics-attendance", dateRange.from, dateRange.to], () =>
    api.getAttendanceAnalytics(dateRange.from, dateRange.to),
  );

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Analytics &amp; Reports</h1>
        <p className="text-muted-foreground text-sm">
          Institution-wide aggregate reporting — operational, academic, attendance, and enrollment analytics, computed live
          from current data. Every card can be exported as CSV or Excel.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Operational</CardTitle>
          <ExportButtons
            onCsv={() => downloadFile(() => api.exportOperationalAnalytics("csv"), "operational.csv")}
            onXlsx={() => downloadFile(() => api.exportOperationalAnalytics("xlsx"), "operational.xlsx")}
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
    </div>
  );
}
