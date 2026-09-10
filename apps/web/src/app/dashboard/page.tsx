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
import {
  Banknote,
  Building2,
  CalendarCheck,
  ClipboardList,
  GraduationCap,
  MessageSquare,
  UserPlus,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { OnboardingChecklist, type OnboardingStep } from "@/components/dashboard/onboarding-checklist";
import { api } from "@/lib/api";
import { formatRelativeTime } from "@/lib/relative-time";

// The theme's own --chart-1..5 tokens (globals.css) — defined for both
// light and dark but never actually used by any component until the
// charts on this page, referenced directly as CSS vars (not hardcoded
// hex) so a chart's colors follow the same theme switch as everything
// else, light or dark.
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const NPR = new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 });

const QUICK_ACTIONS = [
  { href: "/dashboard/students#students", label: "Add student", icon: GraduationCap },
  { href: "/dashboard/staff#employees", label: "Add employee", icon: UserPlus },
  { href: "/dashboard/attendance", label: "Take attendance", icon: CalendarCheck },
  { href: "/dashboard/finance", label: "Record payment", icon: Banknote },
  { href: "/dashboard/communication", label: "Send message", icon: MessageSquare },
  { href: "/dashboard/admissions", label: "New admission", icon: ClipboardList },
] as const;

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

// The home dashboard — the very first thing landed on, top of the
// sidebar. Used to be an Institution/Campus setup form with four bare
// stat cards bolted on (that setup form now lives at
// /dashboard/institutions); this used to also be split across a
// separate "/dashboard/overview" page ("Highlights") tucked under
// Insights — its stats/charts/activity feed are folded in here
// instead, since a home dashboard is exactly what that page already
// was.
export default function DashboardPage() {
  const organizationQuery = useSWR("organization", () => api.getOwnOrganization());
  const organization = organizationQuery.data;
  const campusesQuery = useSWR("campuses", () => api.listCampuses());
  const campuses = campusesQuery.data ?? [];
  const applicationsQuery = useSWR("admission-applications", () => api.listAdmissionApplications());
  const applications = applicationsQuery.data ?? [];

  const operational = useSWR("analytics-operational", () => api.getOperationalAnalytics());
  const enrollment = useSWR("analytics-enrollment", () => api.getEnrollmentAnalytics());
  const academic = useSWR("analytics-academic", () => api.getAcademicAnalytics());
  const financial = useSWR("analytics-financial", () => api.getFinancialAnalytics());
  const activity = useSWR("recent-audit-logs", () => api.listAuditLogs({ limit: 10 }));

  // Getting-started checklist (UX audit finding) — driven entirely by
  // real counts, same SWR keys the pages that actually own each of
  // these already use, so a session that's visited them dedupes
  // instead of double-fetching. Every one of these lists is a small,
  // org-scoped catalog table (already fetched unbounded elsewhere in
  // this app) except students/employees/enrollments, which read their
  // own `.total` from the paginated list endpoints instead.
  //
  // Deliberately reading the raw (non-defaulted) `.data` here, not
  // `data = []` — this is the exact "still loading" vs "genuinely
  // empty" distinction the audit itself flagged for EntityCard (#06).
  // With this many requests firing in parallel on every dashboard
  // load, some are still in flight for a moment; defaulting straight
  // to `[]` would count an unloaded step as "not done," which would
  // even flash this whole card into view on an org that's actually
  // fully set up, right before the last request resolves and it
  // disappears.
  const studentsQuery = useSWR("students-count", () => api.listStudents({ pageSize: 1 }));
  const studentsPage = studentsQuery.data;
  const employeesQuery = useSWR("employees-count", () => api.listEmployees({ pageSize: 1 }));
  const employeesPage = employeesQuery.data;
  const facultiesQuery = useSWR("faculties", () => api.listFaculties());
  const departmentsQuery = useSWR("departments", () => api.listDepartments());
  const programsQuery = useSWR("programs", () => api.listPrograms());
  const academicYearsQuery = useSWR("academic-years", () => api.listAcademicYears());
  const semestersQuery = useSWR("semesters", () => api.listSemesters());
  const sectionsQuery = useSWR("sections", () => api.listSections());
  const staffTypesQuery = useSWR("staff-types", () => api.listStaffTypes());
  const designationsQuery = useSWR("designations", () => api.listDesignations());
  const enrollmentsQuery = useSWR("enrollments-count", () => api.listAllEnrollments({ pageSize: 1 }));
  const feeCategoriesQuery = useSWR("fee-categories", () => api.listFeeCategories());
  const feeStructuresQuery = useSWR("fee-structures", () => api.listFeeStructures());
  // "Your first week" — usage nudges shown only once the setup
  // checklist above is fully done (see OnboardingChecklist). Same
  // cache-key-reuse principle as the setup steps: the first two reuse
  // the Attendance/Communication pages' own SWR keys, so a session
  // that's visited either dedupes instead of double-fetching. The
  // third is a genuinely new read — the audit-log signal
  // AnalyticsController now writes on every report export.
  const attendanceSessionsQuery = useSWR("attendance-sessions", () => api.listAttendanceSessions());
  const messagesQuery = useSWR("messages", () => api.listMessages());
  const reportExportsQuery = useSWR("audit-logs-analytics-export", () =>
    api.listAuditLogs({ resource: "analytics", action: "analytics.report_exported", limit: 1 }),
  );

  const onboardingDataLoaded = [
    campusesQuery.data,
    studentsPage,
    employeesPage,
    facultiesQuery.data,
    departmentsQuery.data,
    programsQuery.data,
    academicYearsQuery.data,
    semestersQuery.data,
    sectionsQuery.data,
    staffTypesQuery.data,
    designationsQuery.data,
    enrollmentsQuery.data,
    feeCategoriesQuery.data,
    feeStructuresQuery.data,
    attendanceSessionsQuery.data,
    messagesQuery.data,
    reportExportsQuery.data,
  ].every((d) => d !== undefined);

  const onboardingSteps: OnboardingStep[] = [
    { label: "Institution", done: campuses.length > 0, href: "/dashboard/institutions" },
    { label: "Faculty", done: (facultiesQuery.data ?? []).length > 0, href: "/dashboard/org-structure#faculties" },
    {
      label: "Department",
      done: (departmentsQuery.data ?? []).length > 0,
      href: "/dashboard/org-structure#departments",
    },
    { label: "Program", done: (programsQuery.data ?? []).length > 0, href: "/dashboard/org-structure#programs" },
    {
      label: "Academic year",
      done: (academicYearsQuery.data ?? []).length > 0,
      href: "/dashboard/org-structure#academic-years",
    },
    { label: "Semester", done: (semestersQuery.data ?? []).length > 0, href: "/dashboard/org-structure#semesters" },
    { label: "Section", done: (sectionsQuery.data ?? []).length > 0, href: "/dashboard/org-structure#sections" },
    { label: "Staff type", done: (staffTypesQuery.data ?? []).length > 0, href: "/dashboard/staff#staff-types" },
    {
      label: "Designation",
      done: (designationsQuery.data ?? []).length > 0,
      href: "/dashboard/staff#designations",
    },
    { label: "Employee", done: (employeesPage?.total ?? 0) > 0, href: "/dashboard/staff#employees" },
    { label: "Student", done: (studentsPage?.total ?? 0) > 0, href: "/dashboard/students#students" },
    {
      label: "Enrollment",
      done: (enrollmentsQuery.data?.total ?? 0) > 0,
      href: "/dashboard/students#enrollment",
    },
    {
      label: "Fee category",
      done: (feeCategoriesQuery.data ?? []).length > 0,
      href: "/dashboard/finance#fee-categories",
    },
    {
      label: "Fee structure",
      done: (feeStructuresQuery.data ?? []).length > 0,
      href: "/dashboard/finance#fee-structures",
    },
  ];
  const firstWeekSteps: OnboardingStep[] = [
    { label: "Take attendance once", done: (attendanceSessionsQuery.data ?? []).length > 0, href: "/dashboard/attendance" },
    { label: "Send one message", done: (messagesQuery.data ?? []).length > 0, href: "/dashboard/communication" },
    { label: "Run one report", done: (reportExportsQuery.data ?? []).length > 0, href: "/dashboard/analytics" },
  ];

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        {organization ? (
          <h1 className="text-2xl font-semibold">{organization.name}</h1>
        ) : organizationQuery.error ? (
          <h1 className="text-destructive text-2xl font-semibold">
            Couldn&apos;t load —{" "}
            <button
              type="button"
              onClick={() => organizationQuery.mutate()}
              className="underline underline-offset-2"
            >
              retry
            </button>
          </h1>
        ) : (
          <h1 className="text-2xl font-semibold">Loading…</h1>
        )}
        <p className="text-muted-foreground text-sm">
          A glanceable summary of the institution, computed live from current data. Your organization&apos;s data is
          private — nothing here is visible to any other school on this platform.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="border-border/60 bg-card hover:border-primary/40 hover:bg-accent flex flex-col items-center gap-2 rounded-xl border p-4 text-center shadow-sm transition-colors"
          >
            <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
              <action.icon className="size-4" />
            </span>
            <span className="text-xs font-medium">{action.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label={campuses.length === 1 ? "Institution" : "Institutions"}
          value={campuses.length}
          icon={<Building2 className="size-4" />}
          error={!!campusesQuery.error}
          onRetry={() => campusesQuery.mutate()}
        />
        <StatCard
          label="Active students"
          value={operational.data?.activeStudents ?? "—"}
          icon={<GraduationCap className="size-4" />}
          error={!!operational.error}
          onRetry={() => operational.mutate()}
        />
        <StatCard
          label="Active staff"
          value={operational.data?.activeStaff ?? "—"}
          icon={<Users className="size-4" />}
          error={!!operational.error}
          onRetry={() => operational.mutate()}
        />
        <StatCard
          label="Active enrollments"
          value={operational.data?.activeEnrollments ?? "—"}
          icon={<GraduationCap className="size-4" />}
          error={!!operational.error}
          onRetry={() => operational.mutate()}
        />
        <StatCard
          label="Outstanding fees"
          value={operational.data ? NPR.format(operational.data.outstandingAmount) : "—"}
          icon={<Banknote className="size-4" />}
          error={!!operational.error}
          onRetry={() => operational.mutate()}
        />
        <StatCard
          label="Admissions"
          value={applications.length}
          icon={<ClipboardList className="size-4" />}
          error={!!applicationsQuery.error}
          onRetry={() => applicationsQuery.mutate()}
        />
      </div>

      {onboardingDataLoaded ? (
        <OnboardingChecklist steps={onboardingSteps} firstWeekSteps={firstWeekSteps} />
      ) : null}

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
            <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
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
            <Bar dataKey="count" fill="var(--chart-2)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
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
