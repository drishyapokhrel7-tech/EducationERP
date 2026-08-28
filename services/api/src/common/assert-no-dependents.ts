import { ConflictException } from "@nestjs/common";

/**
 * Shared guard for every reference/setup (catalog) entity's delete
 * route — count() thunks for every model that has a real FK pointing
 * at the row about to be deleted, sum them, and refuse with a clear
 * 409 if anything still depends on it. No cascade, no silent
 * orphaning: the caller must reassign/remove the dependents first.
 * Mirrors RBAC.deleteRole's own count-then-ConflictException shape
 * (the one delete-with-dependency-check precedent in this codebase
 * before this helper existed), generalized so every entity's delete
 * method doesn't retype the same three lines.
 */
export async function assertNoDependents(counts: Promise<number>[], label: string): Promise<void> {
  const total = (await Promise.all(counts)).reduce((sum, n) => sum + n, 0);
  if (total > 0) {
    throw new ConflictException(
      `This ${label} is still referenced by ${total} other record(s) — remove or reassign those first`,
    );
  }
}
