"use client";

// Segment error boundary for the whole /dashboard subtree. Before
// this, a render throw inside any dashboard page (a `.map` on data
// that came back undefined because the API 401'd or the DB was
// mid-hiccup) blanked the entire viewport to white with nothing to
// click. Now it degrades to a recoverable card. Pairs with the
// api-client's silent token refresh (auth-storage) and
// PrismaService.withTenant's transient-error retry — together those
// mean this boundary should rarely fire, and when it does the user
// isn't stuck.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@education-erp/api-client";
import { Button } from "@/components/ui/button";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    // Surface it for whatever monitoring is wired to console/errors.
    console.error("[dashboard] unhandled error:", error);
  }, [error]);

  const isAuth = error instanceof ApiError && (error.status === 401 || error.status === 403);
  const isServer = error instanceof ApiError && error.status >= 500;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="bg-card w-full max-w-md space-y-4 rounded-xl border p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold">
          {isAuth ? "Your session needs a refresh" : "Something went wrong on this page"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {isAuth
            ? "You may have been signed out. Sign in again to continue."
            : isServer
              ? "The server had trouble responding — this is usually momentary. Try again in a few seconds."
              : "An unexpected error stopped this page from loading. You can retry, or head back to the dashboard."}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {isAuth ? (
            <Button onClick={() => router.push("/login")}>Sign in again</Button>
          ) : (
            <Button onClick={reset}>Try again</Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              router.push("/dashboard");
              reset();
            }}
          >
            Back to dashboard
          </Button>
        </div>
        {error.digest ? <p className="text-muted-foreground text-[11px]">Reference: {error.digest}</p> : null}
      </div>
    </main>
  );
}
