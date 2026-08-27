"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

// Shared by /teacher and /portal (LMS discovery slice 9) — a
// notification is "for whoever is logged into this account," so one
// component works for every role rather than a per-portal variant.
// Polls rather than pushing — no websocket/real-time infra exists
// anywhere in this project, same standing precedent as Transport's
// own tracking polling.
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const notifications = useSWR("notifications", () => api.listNotifications(), { refreshInterval: 30000 });

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const unreadCount = notifications.data?.filter((n) => !n.isRead).length ?? 0;

  return (
    <div className="relative" ref={containerRef}>
      <Button variant="ghost" size="icon" className="relative" onClick={() => setOpen((o) => !o)}>
        <Bell className="size-4" />
        {unreadCount > 0 ? (
          <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full text-[10px] leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </Button>
      {open ? (
        <div className="bg-popover ring-foreground/10 absolute right-0 z-50 mt-2 w-80 rounded-lg p-2 shadow-md ring-1">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-sm font-medium">Notifications</span>
            {unreadCount > 0 ? (
              <button
                type="button"
                className="text-muted-foreground text-xs underline-offset-4 hover:underline"
                onClick={async () => {
                  await api.markAllNotificationsRead();
                  notifications.mutate();
                }}
              >
                Mark all read
              </button>
            ) : null}
          </div>
          {!notifications.data || notifications.data.length === 0 ? (
            <p className="text-muted-foreground p-2 text-sm">No notifications yet.</p>
          ) : (
            <ul className="max-h-80 divide-y overflow-y-auto">
              {notifications.data.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.link ?? "#"}
                    className={`hover:bg-accent block rounded-md px-2 py-2 text-sm ${n.isRead ? "" : "font-medium"}`}
                    onClick={async () => {
                      setOpen(false);
                      if (!n.isRead) {
                        await api.markNotificationRead(n.id);
                        notifications.mutate();
                      }
                    }}
                  >
                    <p>{n.title}</p>
                    <p className="text-muted-foreground text-xs font-normal">{new Date(n.createdAt).toLocaleString()}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
