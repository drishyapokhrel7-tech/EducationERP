"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EditionComparisonGrid } from "@/components/edition-comparison";

// Sets expectations before the first record-limit wall, not at it —
// purely informational, every tier shown, no upgrade prompt here.
export function PlansStep({ onNext }: { onNext: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>What you get at each plan</CardTitle>
          <CardDescription>
            You&apos;re starting on Free — here&apos;s what Professional and Ultra unlock, whenever you need more
            room to grow. You can upgrade any time from Billing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <EditionComparisonGrid currentEdition="FREE" />
          <div className="flex justify-end pt-2">
            <Button type="button" onClick={onNext}>
              Got it, continue
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
