"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { statusVariant } from "@/lib/status-variant";
import { useEditionStatus } from "@/lib/use-edition-status";
import type { Edition, SafeUser } from "@education-erp/api-client";

// Semantic tint per tier — not the app's own accent color, just a
// glance-able distinction between the three, same "state encoded in
// form as well as text" reasoning as every other status Badge in this
// app.
const EDITION_BADGE_VARIANT: Record<Edition, "secondary" | "info" | "success"> = {
  FREE: "secondary",
  PROFESSIONAL: "info",
  ULTRA: "success",
};

const EDITION_LABEL: Record<Edition, string> = {
  FREE: "Free",
  PROFESSIONAL: "Professional",
  ULTRA: "Ultra",
};

// Same click-outside dropdown pattern as NotificationBell — clicking
// the avatar/name in the header opens a small profile card instead of
// navigating anywhere (this app has no dedicated "my profile" page).
// Purely informational — logging out stays on the header's own
// separate icon, not duplicated in here.
// Roles aren't on SafeUser (the object the session stores) — only the
// JWT payload carries them, so this fetches POST auth/me on open
// rather than widening what every page's stored session carries.
export function UserProfilePopover({ user }: { user: SafeUser }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const me = useSWR(open ? "auth-me" : null, () => api.getMe());
  // Unconditional (not gated behind `open` the way `me` is above) —
  // shares the same SWR cache key the billing page already warms, so
  // this is very likely already cached by the time a user opens their
  // profile, avoiding a loading flicker on the one thing this was
  // specifically asked to show prominently.
  const editionStatus = useEditionStatus();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="hover:bg-accent flex items-center gap-2 rounded-full px-1 py-1"
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium">
          {user.firstName} {user.lastName}
        </span>
      </button>
      {open ? (
        <div className="bg-popover ring-foreground/10 absolute right-0 z-50 mt-2 w-72 rounded-lg p-4 shadow-md ring-1">
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">
                {user.firstName} {user.lastName}
              </p>
              {editionStatus.data ? (
                <Badge variant={EDITION_BADGE_VARIANT[editionStatus.data.edition]} className="mt-1">
                  {EDITION_LABEL[editionStatus.data.edition]}
                </Badge>
              ) : null}
            </div>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">User Code</dt>
              {/* The actual identifier this account logs in with —
                  matches the login page's "User Id" field exactly.
                  Students/staff-with-a-username log in with that;
                  everyone else logs in with their email. Never the
                  raw `id` — that's a DB primary key, never typed
                  anywhere. */}
              <dd className="font-mono text-xs">{user.username ?? user.email}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="text-xs">{user.email}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Role</dt>
              <dd>
                {!me.data ? (
                  <span className="text-muted-foreground">Loading…</span>
                ) : me.data.roles.length === 0 ? (
                  <span className="text-muted-foreground">None</span>
                ) : (
                  me.data.roles.join(", ")
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <Badge variant={statusVariant(user.status)}>{user.status}</Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Email verified</dt>
              <dd>{user.emailVerifiedAt ? "Yes" : "Not yet"}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
