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

export async function submitAction(action: () => Promise<unknown>, onSuccess: () => void): Promise<void> {
  try {
    await action();
    onSuccess();
    toast.success("Saved");
  } catch (err) {
    toast.error(errorMessage(err, "Failed"));
  }
}
