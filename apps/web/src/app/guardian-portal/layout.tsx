"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notification-bell";
import { useAuth } from "@/lib/auth-context";

const NAV = [
  { href: "/guardian-portal", label: "My Children" },
  { href: "/guardian-portal/schedule", label: "Schedule" },
  { href: "/guardian-portal/quizzes", label: "Quizzes" },
  { href: "/guardian-portal/questions", label: "Questions" },
];

export default function GuardianPortalLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  // Same post-hydration guard as dashboard/layout.tsx and portal/layout.tsx.
  const [mounted, setMounted] = useState(false);
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
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Users className="size-5" />
            <span className="font-semibold">Education ERP — Guardian Portal</span>
          </div>
          <nav className="flex items-center gap-4">
            {NAV.map(({ href, label }) => (
              <Link key={href} href={href} className="text-muted-foreground hover:text-foreground text-sm">
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">
            {user.firstName} {user.lastName}
          </span>
          <NotificationBell />
          <Button variant="ghost" size="icon" onClick={() => logout().then(() => router.push("/login"))}>
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
