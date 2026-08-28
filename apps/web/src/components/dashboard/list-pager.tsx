import { Button } from "@/components/ui/button";

// Phase 8 performance-optimization slice. Plain Prev/Next + "page X of
// Y" — chosen over infinite-scroll/"Load more" because it needs no
// extra accumulation state and matches this app's existing plain,
// synchronous list-card style everywhere else. Shared by every
// paginated list (Students, Staff, Finance's invoice list, ...).
export function ListPager({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-2 text-sm">
      <Button type="button" variant="outline" size="sm" onClick={onPrev} disabled={page <= 1}>
        Previous
      </Button>
      <span className="text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Button type="button" variant="outline" size="sm" onClick={onNext} disabled={page >= totalPages}>
        Next
      </Button>
    </div>
  );
}
