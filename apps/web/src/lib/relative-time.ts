// No date library exists anywhere in this app (checked directly) —
// this is a small, focused helper for exactly one need (a "2 hours
// ago"-style label on an audit-log feed), not a general date-math
// utility. Falls back to a plain locale date once something is more
// than a week old, where "N days ago" stops being a useful unit.
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffSeconds = Math.max(0, Math.floor((Date.now() - then) / 1000));

  if (diffSeconds < 60) return "just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}
