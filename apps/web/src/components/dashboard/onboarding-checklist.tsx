import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface OnboardingStep {
  label: string;
  done: boolean;
  // Absent for the one step this page itself already handles
  // (Institution) — nothing to link to.
  href?: string;
}

// A getting-started checklist for a brand-new org, driven entirely by
// real counts already being fetched for the dashboard's own stat
// cards — never a stored "onboarded" flag to fall out of sync with
// reality. The real setup chain is 14 steps deep and every step
// hard-blocks the next, with the only previous hint anywhere being
// one sentence on the Org Structure page — this surfaces the whole
// chain up front and points at exactly what's next. Disappears on its
// own once every step is done; there's nothing to dismiss.
export function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  const remaining = steps.filter((s) => !s.done);
  if (remaining.length === 0) return null;
  const nextStep = remaining[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Getting started</CardTitle>
        <CardDescription>
          {steps.length - remaining.length} of {steps.length} set up — each step needs the one before it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-1.5 text-sm">
          {steps.map((step) => {
            const isNext = step === nextStep;
            const content = (
              <span className="flex items-center gap-2">
                {step.done ? (
                  <Check className="text-primary size-4 shrink-0" />
                ) : (
                  <Circle className="text-muted-foreground/40 size-4 shrink-0" />
                )}
                <span className={step.done ? "text-muted-foreground line-through" : undefined}>{step.label}</span>
                {isNext ? (
                  <Badge variant="info" className="ml-1">
                    Next
                  </Badge>
                ) : null}
              </span>
            );
            return (
              <li key={step.label}>
                {!step.done && step.href ? (
                  <Link href={step.href} className="hover:text-primary inline-flex">
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
