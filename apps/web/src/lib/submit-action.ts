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

export async function submitAction(
  action: () => Promise<unknown>,
  onSuccess: () => void,
  successMessage = "Saved",
): Promise<void> {
  try {
    await action();
    onSuccess();
    toast.success(successMessage);
  } catch (err) {
    toast.error(errorMessage(err, "Failed"));
  }
}

// Thin wrapper for delete buttons — every one of them was popping a
// green "Saved" on a destructive action (a delete succeeding via
// submitAction's own default), which reads as wrong at best and
// alarming at worst. Same helper, just says "Deleted." Renaming a
// delete call site from submitAction to submitDelete is a single
// find-and-replace, not a signature change at every call site.
export function submitDelete(action: () => Promise<unknown>, onSuccess: () => void): Promise<void> {
  return submitAction(action, onSuccess, "Deleted");
}
