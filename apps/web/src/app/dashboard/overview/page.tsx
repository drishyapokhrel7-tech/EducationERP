"use client";

import Link from "next/link";
import useSWR from "swr";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { api } from "@/lib/api";
import { formatRelativeTime } from "@/lib/relative-time";
import { Building2, ClipboardList, GraduationCap, Users } from "lucide-react";

// The theme's own --chart-1..5 tokens (globals.css) — defined for both
// light and dark but never actually used by any component until this
// page, the first real chart in the app. Referenced directly as CSS
// vars (not hardcoded hex) so a chart's colors follow the same theme
// switch as everything else, light or dark.
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const NPR = new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 });

function ChartCard({
  title,
  loading,
  empty,
  children,
}: {
  title: string;
  loading: boolean;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : empty ? (
          <p className="text-muted-foreground text-sm">No data yet.</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              {children as never}
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function OverviewPage() {
  const operational = useSWR("analytics-operational", () => api.getOperationalAnalytics());
  const enrollment = useSWR("analytics-enrollment", () => api.getEnrollmentAnalytics());
  const academic = useSWR("analytics-academic", () => api.getAcademicAnalytics());
  const financial = useSWR("analytics-financial", () => api.getFinancialAnalytics());
  const activity = useSWR("recent-audit-logs", () => api.listAuditLogs({ limit: 10 }));

  return (
      <div className="max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Highlights</h1>
          <p className="text-muted-foreground text-sm">
            A glanceable summary of the institution, computed live from current data. For the full breakdown —
            attendance, examinations, continuous learning, alumni outcomes — and CSV/Excel/PDF exports, see{" "}
            <Link href="/dashboard/analytics" className="underline underline-offset-4">
              Analytics &amp; Reports
            </Link>
            .
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Active students"
            value={operational.data?.activeStudents ?? "—"}
            icon={<GraduationCap className="size-4" />}
          />
          <StatCard
            label="Active staff"
            value={operational.data?.activeStaff ?? "—"}
            icon={<Users className="size-4" />}
          />
          <StatCard
            label="Active enrollments"
            value={operational.data?.activeEnrollments ?? "—"}
            icon={<Building2 className="size-4" />}
          />
          <StatCard
            label="Outstanding fees"
            value={operational.data ? NPR.format(operational.data.outstandingAmount) : "—"}
            icon={<ClipboardList className="size-4" />}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ChartCard
            title="Admissions funnel"
            loading={!enrollment.data}
            empty={(enrollment.data?.admissionsFunnel.length ?? 0) === 0}
          >
            <PieChart>
              <Pie
                data={enrollment.data?.admissionsFunnel ?? []}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                startAngle={0}
                endAngle={360}
                innerRadius={55}
                outerRadius={90}
              >
                {(enrollment.data?.admissionsFunnel ?? []).map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ChartCard>

          <ChartCard
            title="Enrollment trend"
            loading={!enrollment.data}
            empty={(enrollment.data?.enrollmentTrend.length ?? 0) === 0}
          >
            <BarChart data={enrollment.data?.enrollmentTrend ?? []}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="academicYear" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>

          <ChartCard
            title="Enrollment by program"
            loading={!academic.data}
            empty={(academic.data?.enrollmentByProgram.length ?? 0) === 0}
          >
            <BarChart data={academic.data?.enrollmentByProgram ?? []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartCard>

          <Card>
            <CardHeader>
              <CardTitle>Fee collections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!financial.data ? (
                <p className="text-muted-foreground text-sm">Loading…</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Invoiced</p>
                      <p className="font-semibold">{NPR.format(financial.data.totalInvoiced)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Collected</p>
                      <p className="font-semibold">{NPR.format(financial.data.totalCollected)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Outstanding</p>
                      <p className="font-semibold">{NPR.format(financial.data.totalOutstanding)}</p>
                    </div>
                  </div>
                  {financial.data.collectionsByMethod.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No payments recorded yet.</p>
                  ) : (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={financial.data.collectionsByMethod}
                            dataKey="amount"
                            nameKey="method"
                            cx="50%"
                            cy="50%"
                            startAngle={0}
                            endAngle={360}
                            innerRadius={40}
                            outerRadius={70}
                          >
                            {financial.data.collectionsByMethod.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Legend />
                          <Tooltip formatter={(value) => NPR.format(Number(value))} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {!activity.data ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : activity.data.length === 0 ? (
              <p className="text-muted-foreground text-sm">No activity recorded yet.</p>
            ) : (
              <ul className="divide-y">
                {activity.data.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>
                      <span className="font-medium">
                        {entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : "System"}
                      </span>{" "}
                      <span className="text-muted-foreground">
                        {entry.action.toLowerCase()} {entry.resource.replace(/_/g, " ")}
                      </span>
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {formatRelativeTime(entry.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
  );
}
