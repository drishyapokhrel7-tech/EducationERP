"use client";

import { useState } from "react";

// Shared by every list row that shows a Student/Employee/Guardian
// photo (Students, Staff, global search) plus PhotoInput's own
// preview — one place to get "no photo yet" and "the photo URL failed
// to load" right, instead of each call site silently rendering
// nothing for a falsy/broken photoUrl (the actual "photo preview
// missing" bug: a row with no photoUrl previously showed no avatar
// slot at all, and a row whose stored URL failed to load showed a
// broken-image icon instead of anything graceful).
//
// referrerPolicy="no-referrer" is a deliberate defensive default —
// this project's storage driver can be Google Drive
// (STORAGE_DRIVER=google-drive), and Drive's CDN is known to be
// pickier about cross-origin embeds that carry a Referer than ones
// that don't; dropping it costs nothing for the other storage drivers.
export function Avatar({
  src,
  size = "sm",
  alt = "",
}: {
  src: string | null | undefined;
  size?: "sm" | "lg";
  alt?: string;
}) {
  const [broken, setBroken] = useState(false);
  const dim = size === "lg" ? "size-16" : "size-6";

  if (!src || broken) {
    return (
      <div
        className={`bg-muted text-muted-foreground flex ${dim} shrink-0 items-center justify-center rounded-full border ${
          size === "lg" ? "text-[10px]" : ""
        }`}
      >
        {size === "lg" ? "No photo" : null}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- external/storage-backend URL, not a local static asset next/image can optimize
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={`bg-muted ${dim} shrink-0 rounded-full border object-cover`}
    />
  );
}
