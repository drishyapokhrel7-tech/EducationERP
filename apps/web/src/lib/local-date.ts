// `new Date().toISOString()` converts to UTC first — in a timezone
// ahead of UTC (e.g. Nepal, UTC+5:45), local midnight on any given day
// rolls back to the *previous* day once converted, so "today" silently
// reads as yesterday until 05:45 local time. Format from local date
// parts directly instead. Originally fixed once, locally, in
// analytics/page.tsx; pulled out here so the other call sites with the
// identical bug (My Classes Today, Admissions) share the same fix
// rather than each re-deriving it.
export function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayLocalDateString(): string {
  return toLocalDateString(new Date());
}
