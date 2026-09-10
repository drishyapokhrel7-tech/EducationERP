"use client";

// Root-level error boundary — covers /login, /register, /portal,
// /driver, /teacher, /verify and anything else outside /dashboard
// (which has its own). Keeps a render throw from showing a blank
// white page.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    console.error("[app] unhandled error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="bg-card w-full max-w-md space-y-4 rounded-xl border p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground text-sm">
          An unexpected error stopped this page from loading. Retrying often clears it.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button
            variant="outline"
            onClick={() => {
              router.push("/");
              reset();
            }}
          >
            Go home
          </Button>
        </div>
        {error.digest ? <p className="text-muted-foreground text-[11px]">Reference: {error.digest}</p> : null}
      </div>
    </main>
  );
}
