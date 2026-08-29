"use client";

// A sticky in-page jump-nav for the app's few genuinely long pages
// (Hostel, Alumni, Library, Inventory, Org Structure — each 6+ stacked
// Cards with no way to skip ahead before this). Deliberately a plain
// anchor-link bar, not a real tab system that hides/shows content —
// every Card underneath stays mounted and exactly as it already was,
// this only adds a way to jump straight to one instead of scrolling
// past the others. Matches the audit's own "layout only, no logic
// changes" framing.
export function PageSubNav({ sections }: { sections: { id: string; label: string }[] }) {
  return (
    <nav
      aria-label="Jump to section"
      className="bg-background/95 sticky top-0 z-10 -mx-6 flex flex-wrap gap-1 border-b px-6 py-2 backdrop-blur"
    >
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md px-2.5 py-1 text-sm transition-colors"
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}
