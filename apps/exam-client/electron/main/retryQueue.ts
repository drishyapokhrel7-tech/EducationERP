import { ApiError } from "@education-erp/api-client";

// The "resilient-online" piece: a network-level failure (fetch never got
// a response — offline, DNS blip, server unreachable) is retried with
// capped exponential backoff until it succeeds. A real HTTP error
// response from the server (ApiError — 409 already submitted, 400
// window closed) is a definitive answer, not a connectivity problem, and
// is surfaced immediately instead of retried. This queue is in-memory
// only: a force-quit mid-retry loses that one pending call, which is the
// explicit, documented boundary between "resilient-online" (this) and
// "true offline" (not built here).
const BACKOFF_STEPS_MS = [1000, 2000, 4000, 8000, 15000];

export type SyncStatus = "idle" | "saving" | "retrying" | "saved" | "failed";

function isRetryable(err: unknown): boolean {
  return !(err instanceof ApiError);
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  onStatus: (status: SyncStatus) => void,
  isCancelled: () => boolean = () => false,
): Promise<T | undefined> {
  onStatus("saving");
  let attempt = 0;
  for (;;) {
    if (isCancelled()) return undefined;
    try {
      const result = await fn();
      if (isCancelled()) return undefined;
      onStatus("saved");
      return result;
    } catch (err) {
      if (!isRetryable(err)) {
        onStatus("failed");
        throw err;
      }
      onStatus("retrying");
      const delay = BACKOFF_STEPS_MS[Math.min(attempt, BACKOFF_STEPS_MS.length - 1)];
      attempt += 1;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// Per-attempt answer sync: only the latest edit per questionId matters —
// if the student changes an answer again before the previous save has
// finished retrying, the newer value supersedes the older one rather
// than sending both. A superseded call is cancelled outright (checked
// before its first attempt and before every retry) rather than left to
// run to completion — otherwise a stale retry could still land *after*
// the newer save already succeeded and silently overwrite it.
export class AnswerSyncQueue {
  private latestVersion = new Map<string, number>();

  async send<T>(
    questionId: string,
    fn: () => Promise<T>,
    onStatus: (status: SyncStatus) => void,
  ): Promise<T | undefined> {
    const version = (this.latestVersion.get(questionId) ?? 0) + 1;
    this.latestVersion.set(questionId, version);
    const isStale = () => this.latestVersion.get(questionId) !== version;
    return retryWithBackoff(fn, onStatus, isStale);
  }
}
