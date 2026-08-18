"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  LayoutDashboard,
  LogOut,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

const NAV = [{ href: "/dashboard", label: "Overview", icon: LayoutDashboard }];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.replace("/login");
    }
  }, [user, router]);

  if (!user) {
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
            <a
              key={href}
              href={href}
              className="hover:bg-sidebar-accent flex items-center gap-2 rounded-md px-2 py-2 text-sm"
            >
              <Icon className="size-4" />
              {label}
            </a>
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
