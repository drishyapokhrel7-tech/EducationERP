import { toast } from "sonner";

// Shared save/delete boilerplate — extracted from roles-permissions/
// page.tsx (the one page that already had this pattern) so the many
// new edit/delete forms across the reference/setup admin pages don't
// each retype the same try/onSuccess/toast/catch shape.
export function errorMessage(err: unknown, fallback: string): string {
  const message =
    err && typeof err === "object" && "body" in err
      ? ((err as { body?: { message?: string } }).body?.message ?? null)
      : null;
  return typeof message === "string" ? message : fallback;
}

// Built on sonner's toast.promise rather than a plain try/await/catch —
// one toast that starts as a spinner (loadingMessage) the instant the
// action fires and resolves in place to success/error, instead of no
// feedback at all until the request finishes. This is what actually
// gives every submitAction/submitDelete call site in the app a
// progress indicator for free — no per-page button-disabled/spinner
// state needed, and no call site needs to change to get it.
// onSuccess optionally receives the action's own resolved value (e.g.
// a just-created record's id) — existing zero-arg callbacks stay valid
// as-is, TS allows a function of fewer declared params to satisfy one
// expecting more.
export function submitAction<T>(
  action: () => Promise<T>,
  onSuccess: (result: T) => void,
  successMessage = "Saved",
  loadingMessage = "Working…",
): void {
  toast.promise(() => action().then((result) => (onSuccess(result), result)), {
    loading: loadingMessage,
    success: successMessage,
    error: (err) => errorMessage(err, "Failed"),
  });
}

// Thin wrapper for delete buttons — every one of them was popping a
// green "Saved" on a destructive action (a delete succeeding via
// submitAction's own default), which reads as wrong at best and
// alarming at worst. Same helper, just says "Deleted"/"Deleting…".
// Renaming a delete call site from submitAction to submitDelete is a
// single find-and-replace, not a signature change at every call site.
export function submitDelete<T>(action: () => Promise<T>, onSuccess: (result: T) => void): void {
  submitAction(action, onSuccess, "Deleted", "Deleting…");
}
