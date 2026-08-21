import { ApiError } from "@education-erp/api-client";
import { AnswerSyncQueue, retryWithBackoff } from "./retryQueue";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("retryWithBackoff", () => {
  it("returns the result immediately on success", async () => {
    const statuses: string[] = [];
    const result = await retryWithBackoff(
      () => Promise.resolve("ok"),
      (s) => statuses.push(s),
    );
    expect(result).toBe("ok");
    expect(statuses).toEqual(["saving", "saved"]);
  });

  it("retries a network-level failure until it succeeds", async () => {
    let attempts = 0;
    const fn = jest.fn(() => {
      attempts += 1;
      if (attempts < 3) return Promise.reject(new Error("network down"));
      return Promise.resolve("ok");
    });
    const statuses: string[] = [];
    const promise = retryWithBackoff(fn, (s) => statuses.push(s));
    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(2000);
    const result = await promise;
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(statuses).toEqual(["saving", "retrying", "retrying", "saved"]);
  });

  it("does not retry a real HTTP error response — surfaces it immediately", async () => {
    const fn = jest.fn(() => Promise.reject(new ApiError(409, { message: "already submitted" })));
    const statuses: string[] = [];
    await expect(retryWithBackoff(fn, (s) => statuses.push(s))).rejects.toThrow(ApiError);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(statuses).toEqual(["saving", "failed"]);
  });
});

describe("AnswerSyncQueue", () => {
  it("cancels a superseded call instead of letting it overwrite a newer save", async () => {
    // The first save for questionId "q1" keeps failing (never resolves
    // within this test); a second, newer save for the same question
    // succeeds immediately. The first call must not be allowed to land
    // afterward and clobber the second's result — this is the exact bug
    // class the version-check guards against.
    const queue = new AnswerSyncQueue();
    const firstAttempts: number[] = [];
    const firstPromise = queue.send(
      "q1",
      () => {
        firstAttempts.push(Date.now());
        return Promise.reject(new Error("still offline"));
      },
      () => undefined,
    );

    const secondResult = await queue.send("q1", () => Promise.resolve("second-value"), () => undefined);
    expect(secondResult).toBe("second-value");

    // Advance past every backoff step the first call would have used —
    // it must resolve to undefined (cancelled), never to a value that
    // could overwrite the second call's already-saved result.
    await jest.advanceTimersByTimeAsync(1000 + 2000 + 4000 + 8000 + 15000);
    const firstResult = await firstPromise;
    expect(firstResult).toBeUndefined();
  });

  it("does not cross-cancel unrelated questions", async () => {
    const queue = new AnswerSyncQueue();
    const a = await queue.send("qA", () => Promise.resolve("a"), () => undefined);
    const b = await queue.send("qB", () => Promise.resolve("b"), () => undefined);
    expect(a).toBe("a");
    expect(b).toBe("b");
  });
});
