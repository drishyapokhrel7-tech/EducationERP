"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthTokens, SafeUser } from "@education-erp/api-client";
import { setStoredSession } from "@/lib/auth-storage";

// Bridge for the Ovexa School marketing site's /portal login page
// (a separate origin — see school/app/portal/page.js in the website
// repo). That page authenticates directly against this API's
// /auth/login and hands the raw response here via the URL fragment
// (never the query string, so it never reaches a server log), in the
// exact shape auth-context.tsx's own login() already stores. This
// page's only job is to store it the same way and route onward —
// the fragment is read client-side only and cleared immediately.
function decodeJwtRoles(token: string): string[] {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const decoded = JSON.parse(json) as { roles?: unknown };
    return Array.isArray(decoded.roles) ? decoded.roles.filter((r) => typeof r === "string") : [];
  } catch {
    return [];
  }
}

export default function SsoBridgePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/[#&]s=([^&]+)/);
    if (!match) {
      setError("Missing sign-in token.");
      return;
    }

    try {
      const b64 = match[1].replace(/-/g, "+").replace(/_/g, "/");
      const json = atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "="));
      const result = JSON.parse(json) as AuthTokens & { user: SafeUser };

      setStoredSession({ tokens: result, user: result.user });
      // Clear the fragment immediately — it's already consumed, no
      // reason for the token to linger in history/back-navigation.
      window.history.replaceState(null, "", "/sso");

      const roles = decodeJwtRoles(result.accessToken);
      router.replace(roles.includes("Student") ? "/portal" : "/dashboard");
    } catch {
      setError("Sign-in failed. Please try logging in again.");
    }
  }, [router]);

  return (
    <main className="flex flex-1 items-center justify-center p-6 text-center">
      {error ? (
        <div>
          <p className="text-destructive font-medium">{error}</p>
          <a href="/login" className="underline text-sm">
            Back to login
          </a>
        </div>
      ) : (
        <p className="text-muted-foreground">Signing you in…</p>
      )}
    </main>
  );
}
