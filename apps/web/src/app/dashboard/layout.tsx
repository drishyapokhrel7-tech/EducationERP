"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  BedDouble,
  BookOpen,
  Building2,
  Camera,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
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
  PackageSearch,
  MessageSquare,
  FileBadge,
  Award,
  ListChecks,
  LogOut,
  Network,
  NotebookText,
  Shield,
  Bus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notification-bell";
import { GlobalSearchBox } from "@/components/global-search-box";
import { UserProfilePopover } from "@/components/user-profile-popover";
import { useAuth } from "@/lib/auth-context";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Groups mirror the platform's own domain boundaries (roughly this
// project's phase breakdown) rather than an arbitrary A-Z split —
// each group is a set of modules the same kind of staff member
// actually works across day to day.
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Organization",
    items: [{ href: "/dashboard/org-structure", label: "Org structure", icon: Network }],
  },
  {
    label: "People",
    items: [
      { href: "/dashboard/staff", label: "Staff", icon: Users },
      { href: "/dashboard/students", label: "Students", icon: GraduationCap },
      { href: "/dashboard/admissions", label: "Admissions", icon: ClipboardList },
    ],
  },
  {
    label: "HR & Payroll",
    items: [
      { href: "/dashboard/leave", label: "Leave", icon: CalendarOff },
      { href: "/dashboard/payroll", label: "Payroll", icon: Banknote },
    ],
  },
  {
    label: "Teaching & Learning",
    items: [
      { href: "/dashboard/academics", label: "Academics", icon: BookOpen },
      { href: "/dashboard/syllabus", label: "Syllabus", icon: NotebookText },
      { href: "/dashboard/timetable", label: "Timetable", icon: CalendarClock },
      { href: "/dashboard/attendance", label: "Attendance", icon: CalendarCheck },
      { href: "/dashboard/my-classes-today", label: "My Classes Today", icon: CheckCircle2 },
    ],
  },
  {
    label: "Assessment",
    items: [
      { href: "/dashboard/assignments", label: "Assignments", icon: ClipboardCheck },
      { href: "/dashboard/knowledge-checks", label: "Knowledge Checks", icon: ListChecks },
      { href: "/dashboard/exam-setup", label: "Exam Catalog", icon: FileQuestion },
      { href: "/dashboard/exams", label: "Exams", icon: ScrollText },
      { href: "/dashboard/learning-dashboards", label: "Learning Dashboards", icon: LayoutPanelTop },
    ],
  },
  {
    label: "Finance",
    items: [{ href: "/dashboard/finance", label: "Finance", icon: Wallet }],
  },
  {
    label: "Operations",
    items: [
      { href: "/dashboard/transport", label: "Transport", icon: Bus },
      { href: "/dashboard/hostel", label: "Hostel", icon: BedDouble },
      { href: "/dashboard/library", label: "Library", icon: Library },
      { href: "/dashboard/inventory", label: "Inventory", icon: PackageSearch },
      { href: "/dashboard/communication", label: "Communication", icon: MessageSquare },
      { href: "/dashboard/documents", label: "Documents", icon: FileBadge },
    ],
  },
  {
    label: "Security",
    items: [
      { href: "/dashboard/biometric-policy", label: "Biometric", icon: Fingerprint },
      { href: "/dashboard/cameras", label: "Cameras", icon: Camera },
    ],
  },
  // Split out of "Organization" — Org structure is set up once, early;
  // Roles & Permissions is managed on an ongoing basis, not part of
  // that same initial setup step, so the two didn't belong in one
  // group together (UX audit finding).
  {
    label: "Administration",
    items: [{ href: "/dashboard/roles-permissions", label: "Roles & Permissions", icon: Shield }],
  },
  {
    label: "Alumni & Career",
    items: [{ href: "/dashboard/alumni", label: "Alumni", icon: Award }],
  },
  {
    label: "Analytics",
    items: [{ href: "/dashboard/analytics", label: "Analytics & Reports", icon: BarChart3 }],
  },
];

function isActivePath(pathname: string | null, href: string) {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname?.startsWith(`${href}/`);
}

// A collapsed group re-expanding on every single page navigation was
// its own UX audit finding — this persists the per-viewer choice
// across page loads, same "browser-local, per-viewer convenience"
// class of state as everything else this app keeps in localStorage.
const NAV_GROUPS_STORAGE_KEY = "education-erp.nav-groups-open";

function loadStoredOpenGroups(): Record<string, boolean> | null {
  try {
    const raw = window.localStorage.getItem(NAV_GROUPS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : null;
  } catch {
    return null;
  }
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // Every group starts expanded — grouping is for scanability, not to
  // hide modules by default. Collapsing is a per-group user choice.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_GROUPS.map((g) => [g.label, true])),
  );
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

  // Same one-shot post-hydration read as `mounted` above — localStorage
  // doesn't exist during SSR, so this can't run until the client has
  // actually mounted.
  useEffect(() => {
    const stored = loadStoredOpenGroups();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setOpenGroups((prev) => ({ ...prev, ...stored }));
  }, []);

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = { ...prev, [label]: !(prev[label] ?? true) };
      try {
        window.localStorage.setItem(NAV_GROUPS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage unavailable (private browsing, quota) — the toggle
        // still works for this page view, it just won't persist.
      }
      return next;
    });
  }

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

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border flex w-64 flex-col border-r p-4">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-lg">
            <Building2 className="size-4" />
          </div>
          <span className="font-heading font-semibold">Education ERP</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          <Link
            href="/dashboard"
            className={
              isActivePath(pathname, "/dashboard")
                ? "bg-sidebar-primary text-sidebar-primary-foreground flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium shadow-sm"
                : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/80 flex items-center gap-2 rounded-full px-3 py-2 text-sm"
            }
          >
            <LayoutDashboard className="size-4" />
            Overview
          </Link>

          {NAV_GROUPS.map((group) => {
            const isOpen = openGroups[group.label] ?? true;
            return (
              <div key={group.label} className="mt-2">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className="text-sidebar-foreground/60 hover:text-sidebar-foreground flex w-full items-center justify-between px-3 py-1 text-xs font-semibold tracking-wide uppercase"
                >
                  {group.label}
                  <ChevronDown className={`size-3.5 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                </button>
                {isOpen ? (
                  <div className="flex flex-col gap-1">
                    {group.items.map(({ href, label, icon: Icon }) => {
                      const isActive = isActivePath(pathname, href);
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
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b p-4">
          <GlobalSearchBox />
          <div className="flex items-center gap-3">
            <UserProfilePopover user={user} />
            <NotificationBell />
            <Button variant="ghost" size="icon" onClick={() => logout().then(() => router.push("/login"))}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
