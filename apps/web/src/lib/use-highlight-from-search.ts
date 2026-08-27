"use client";

import { useEffect } from "react";

// Shared by the Students and Staff pages — the destination side of
// GlobalSearchBox's "jump to and highlight" result links (Phase 8
// "global search" bullet, part 1). Reads `?highlight=<elementId>`
// directly off `window.location.search` in an effect (not Next's
// `useSearchParams()`, which needs a Suspense boundary on a
// statically-rendered page — the same "gate anything hydration-
// sensitive behind an effect" precedent this app already follows
// elsewhere) so it only ever runs client-side, after mount.
//
// `ready` should be true once the list this page renders has actually
// loaded — the target element doesn't exist in the DOM until then, so
// the effect re-fires when `ready` flips from false to true.
export function useHighlightFromSearch(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams(window.location.search);
    const highlight = params.get("highlight");
    if (!highlight) return;
    const el = document.getElementById(highlight);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary");
    const timer = setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 1500);
    return () => clearTimeout(timer);
  }, [ready]);
}
