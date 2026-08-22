import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatCardProps extends React.ComponentProps<"div"> {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  hint?: string;
}

function StatCard({ label, value, icon, hint, className, ...props }: StatCardProps) {
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
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
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
