"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

function errorMessage(err: unknown, fallback: string) {
  const message =
    err && typeof err === "object" && "body" in err
      ? ((err as { body?: { message?: string } }).body?.message ?? null)
      : null;
  return typeof message === "string" ? message : fallback;
}

type Result =
  | { state: "success"; edition: string; editionExpiresAt: string | null }
  | { state: "failed"; message: string };

function CallbackContent() {
  const searchParams = useSearchParams();
  // Deterministic for this static callback page — read directly during
  // render rather than stashed into state.
  const data = searchParams.get("data");
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!data) return; // no payload to confirm — the render branch below explains why
    api
      .confirmBillingUpgrade(data)
      .then((res) => setResult({ state: "success", edition: res.edition, editionExpiresAt: res.editionExpiresAt }))
      .catch((err) => setResult({ state: "failed", message: errorMessage(err, "Could not confirm the payment") }));
    // Runs once against this one-time redirect payload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const outcome: Result | { state: "checking" } = !data
    ? { state: "failed", message: "The payment was cancelled or not completed." }
    : (result ?? { state: "checking" });

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>eSewa payment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {outcome.state === "checking" ? <p className="text-muted-foreground text-sm">Confirming your payment…</p> : null}
        {outcome.state === "success" ? (
          <p className="text-sm text-emerald-700">
            Payment received — your edition is now {outcome.edition}
            {outcome.editionExpiresAt
              ? `, renewing or expiring on ${new Date(outcome.editionExpiresAt).toLocaleDateString()}`
              : ""}
            .
          </p>
        ) : null}
        {outcome.state === "failed" ? <p className="text-destructive text-sm">{outcome.message}</p> : null}
        <Link href="/dashboard/billing" className={buttonVariants({ size: "sm" })}>
          Back to Billing
        </Link>
      </CardContent>
    </Card>
  );
}

export default function BillingCallbackPage() {
  return (
    <div className="max-w-5xl">
      <Suspense fallback={<p className="text-muted-foreground text-sm">Loading…</p>}>
        <CallbackContent />
      </Suspense>
    </div>
  );
}
