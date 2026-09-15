"use client";

import useSWR from "swr";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { getRefreshToken } from "@/lib/auth-storage";
import { errorMessage } from "@/lib/submit-action";
import type { AuthSession } from "@education-erp/api-client";

export default function AccountPage() {
  const { logout } = useAuth();
  const sessions = useSWR("auth-sessions", () => api.listSessions(getRefreshToken() ?? undefined));

  async function onRevoke(session: AuthSession) {
    if (session.isCurrent) {
      // Same effect as clicking the header's log-out icon — revokes
      // this device's session server-side and clears the local copy,
      // rather than leaving a dead refresh token sitting in storage
      // until the next silent-refresh attempt 401s on it.
      await logout();
      return;
    }
    try {
      await api.revokeSession(session.id);
      sessions.mutate();
      toast.success("Session logged out");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to log out that session"));
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Manage Sessions</h1>
        <p className="text-muted-foreground text-sm">
          Every device or browser currently logged in to your account. Log out any you don&apos;t recognize.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!sessions.data ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : sessions.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active sessions.</p>
          ) : (
            sessions.data.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {s.userAgent ?? "Unknown device"}
                    </span>
                    {s.isCurrent ? <Badge variant="success">This device</Badge> : null}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {s.ipAddress ? `${s.ipAddress} · ` : ""}
                    Signed in {new Date(s.createdAt).toLocaleString()} · expires{" "}
                    {new Date(s.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <Button type="button" size="sm" variant="destructive" onClick={() => onRevoke(s)}>
                  {s.isCurrent ? "Log out" : "Log out this device"}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
