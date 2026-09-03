import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

export function EntityCard({
  id,
  title,
  titleExtra,
  emptyLabel,
  items,
  renderItem,
  footer,
  children,
  error,
  onRetry,
}: {
  // Optional anchor id, for the sticky in-page sub-nav on this app's
  // few genuinely long pages (PageSubNav) — every existing caller is
  // unaffected since this is optional.
  id?: string;
  title: string;
  // Optional content next to the title (e.g. a usage badge) — every
  // existing caller is unaffected since this is optional.
  titleExtra?: ReactNode;
  emptyLabel: string;
  items: unknown[] | undefined;
  renderItem: (item: never) => ReactNode;
  // Optional content rendered right after the item list, before the
  // separator (e.g. a Prev/Next pager, Phase 8 performance-
  // optimization slice) — every existing caller is unaffected since
  // this is optional.
  footer?: ReactNode;
  children: ReactNode;
  // Optional — true when the underlying SWR fetch has failed rather
  // than still being in flight. SWR leaves `.data` `undefined` in
  // BOTH cases, so without this a request that failed (e.g. this
  // project's own well-documented ambient Neon latency) looked
  // identical to one that's merely slow: a "Loading…" label that
  // never resolved, with no explanation and no way to recover short
  // of a full page reload. Every existing caller that doesn't pass
  // this keeps today's exact "Loading…"-while-undefined behavior.
  error?: boolean;
  onRetry?: () => void;
}) {
  return (
    // scroll-mt accounts for PageSubNav's sticky height on the pages
    // that use it — a no-op for every other page, since it only
    // matters when this card is actually jumped to by its anchor id.
    <Card id={id} className="scroll-mt-16">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        {titleExtra}
      </CardHeader>
      <CardContent className="space-y-4">
        {items === undefined && error ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-destructive text-sm">Couldn&apos;t load — try again.</p>
            {onRetry ? (
              <Button type="button" size="sm" variant="outline" onClick={onRetry}>
                Retry
              </Button>
            ) : null}
          </div>
        ) : items === undefined ? (
          // Distinct from "genuinely empty" below — items is undefined
          // only while the initial fetch is still in flight (SWR's own
          // convention), so a still-loading list never claims to be
          // empty. Matters most on this project's own documented
          // ambient DB latency, where a real fetch can visibly take a
          // beat.
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground text-sm">{emptyLabel}</p>
        ) : (
          <ul className="divide-y">
            {items.map((item, i) => (
              <li key={i} className="py-2 text-sm">
                {renderItem(item as never)}
              </li>
            ))}
          </ul>
        )}
        {footer}
        <Separator />
        {children}
      </CardContent>
    </Card>
  );
}
