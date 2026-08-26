"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  Building2,
  Camera,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileQuestion,
  Fingerprint,
  GraduationCap,
  ScrollText,
  LayoutDashboard,
  Banknote,
  CalendarOff,
  LayoutPanelTop,
  Library,
  ListChecks,
  LogOut,
  Network,
  NotebookText,
  Shield,
  Users,
  Wallet,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/org-structure", label: "Org structure", icon: Network },
  { href: "/dashboard/staff", label: "Staff", icon: Users },
  { href: "/dashboard/leave", label: "Leave", icon: CalendarOff },
  { href: "/dashboard/payroll", label: "Payroll", icon: Banknote },
  { href: "/dashboard/academics", label: "Academics", icon: BookOpen },
  { href: "/dashboard/students", label: "Students", icon: GraduationCap },
  { href: "/dashboard/admissions", label: "Admissions", icon: ClipboardList },
  { href: "/dashboard/finance", label: "Finance", icon: Wallet },
  { href: "/dashboard/timetable", label: "Timetable", icon: CalendarClock },
  { href: "/dashboard/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/dashboard/syllabus", label: "Syllabus", icon: NotebookText },
  { href: "/dashboard/my-classes-today", label: "My Classes Today", icon: CheckCircle2 },
  { href: "/dashboard/assignments", label: "Assignments", icon: ClipboardCheck },
  { href: "/dashboard/knowledge-checks", label: "Knowledge Checks", icon: ListChecks },
  { href: "/dashboard/learning-dashboards", label: "Learning Dashboards", icon: LayoutPanelTop },
  { href: "/dashboard/exam-setup", label: "Exam Setup", icon: FileQuestion },
  { href: "/dashboard/exams", label: "Exams", icon: ScrollText },
  { href: "/dashboard/biometric-policy", label: "Biometric", icon: Fingerprint },
  { href: "/dashboard/cameras", label: "Cameras", icon: Camera },
  { href: "/dashboard/library", label: "Library", icon: Library },
  { href: "/dashboard/roles-permissions", label: "Roles & Permissions", icon: Shield },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // On a cold full-page load, useSyncExternalStore's client snapshot isn't
  // guaranteed to have replaced the (always-null) server snapshot before
  // this component's effects run — observed in practice as a real bug:
  // a valid logged-in session got redirected to /login on any fresh load
  // of a nested dashboard route. `mounted` defers the redirect decision
  // to a render that's unambiguously past hydration.
  const [mounted, setMounted] = useState(false);
  // Intentional one-shot post-hydration flag, not a derived/external-state
  // read — see comment above for why this needs to exist at all.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (mounted && !user) {
      router.replace("/login");
    }
  }, [mounted, user, router]);

  if (!mounted || !user) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </main>
    );
  }

  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border flex w-64 flex-col border-r p-4">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-lg">
            <Building2 className="size-4" />
          </div>
          <span className="font-heading font-semibold">Education ERP</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const isActive = href === "/dashboard" ? pathname === href : pathname === href || pathname?.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium shadow-sm"
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/80 flex items-center gap-2 rounded-full px-3 py-2 text-sm"
                }
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-sidebar-border flex items-center gap-2 border-t pt-4">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-muted-foreground truncate text-xs">{user.email}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => logout().then(() => router.push("/login"))}>
            <LogOut className="size-4" />
          </Button>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
