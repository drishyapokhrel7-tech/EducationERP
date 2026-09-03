import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatCardProps extends React.ComponentProps<"div"> {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  hint?: string;
  // Optional — true when the count behind this card failed to load
  // rather than still being in flight. A caller that reads SWR's
  // `.data` through a `?? 0`/`.length` fallback can't otherwise tell
  // "still loading" from "permanently failed" apart — both silently
  // render as a plain 0, indistinguishable from a genuinely empty
  // count (surfaced against this project's own well-documented
  // ambient Neon latency, where a request can fail outright rather
  // than just being slow). Renders "—" instead of `value` and a
  // clickable retry in place of `hint`. Every existing caller that
  // doesn't pass this keeps today's exact behavior.
  error?: boolean;
  onRetry?: () => void;
}

function StatCard({ label, value, icon, hint, error, onRetry, className, ...props }: StatCardProps) {
  return (
    <div
      data-slot="stat-card"
      className={cn(
        "flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm",
        className,
      )}
      {...props}
    >
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs font-medium">{label}</span>
        <span className="text-2xl font-semibold tracking-tight">{error ? "—" : value}</span>
        {error ? (
          <button
            type="button"
            onClick={onRetry}
            className="text-destructive text-left text-xs underline underline-offset-2"
          >
            Couldn&apos;t load — retry
          </button>
        ) : hint ? (
          <span className="text-muted-foreground text-xs">{hint}</span>
        ) : null}
      </div>
      {icon ? (
        <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
          {icon}
        </div>
      ) : null}
    </div>
  );
}

export { StatCard };
