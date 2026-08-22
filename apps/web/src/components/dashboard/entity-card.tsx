import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function EntityCard({
  title,
  emptyLabel,
  items,
  renderItem,
  children,
}: {
  title: string;
  emptyLabel: string;
  items: unknown[] | undefined;
  renderItem: (item: never) => ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!items || items.length === 0 ? (
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
        <Separator />
        {children}
      </CardContent>
    </Card>
  );
}
