"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Network,
  NotebookText,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/org-structure", label: "Org structure", icon: Network },
  { href: "/dashboard/staff", label: "Staff", icon: Users },
  { href: "/dashboard/academics", label: "Academics", icon: BookOpen },
  { href: "/dashboard/students", label: "Students", icon: GraduationCap },
  { href: "/dashboard/admissions", label: "Admissions", icon: ClipboardList },
  { href: "/dashboard/timetable", label: "Timetable", icon: CalendarClock },
  { href: "/dashboard/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/dashboard/syllabus", label: "Syllabus", icon: NotebookText },
  { href: "/dashboard/my-classes-today", label: "My Classes Today", icon: CheckCircle2 },
  { href: "/dashboard/assignments", label: "Assignments", icon: ClipboardCheck },
  { href: "/dashboard/knowledge-checks", label: "Knowledge Checks", icon: ListChecks },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
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
      <aside className="bg-sidebar text-sidebar-foreground flex w-64 flex-col border-r p-4">
        <div className="mb-6 flex items-center gap-2 px-2">
          <Building2 className="size-5" />
          <span className="font-semibold">Education ERP</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="hover:bg-sidebar-accent flex items-center gap-2 rounded-md px-2 py-2 text-sm"
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 border-t pt-4">
          <Avatar className="size-8">
            <AvatarFallback>{initials}</AvatarFallback>
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
