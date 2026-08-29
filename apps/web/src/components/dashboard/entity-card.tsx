import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function EntityCard({
  id,
  title,
  titleExtra,
  emptyLabel,
  items,
  renderItem,
  footer,
  children,
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
        {items === undefined ? (
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
