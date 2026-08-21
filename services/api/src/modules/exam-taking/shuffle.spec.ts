import { seededShuffle } from "./shuffle";

describe("seededShuffle", () => {
  it("is deterministic for the same seed", () => {
    const items = [0, 1, 2, 3, 4, 5, 6, 7];
    const first = seededShuffle(items, "attempt-1:question-1");
    const second = seededShuffle(items, "attempt-1:question-1");
    expect(second).toEqual(first);
  });

  it("produces a real permutation — same elements, same length", () => {
    const items = [0, 1, 2, 3, 4, 5, 6, 7];
    const shuffled = seededShuffle(items, "attempt-1:question-1");
    expect(shuffled).toHaveLength(items.length);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
  });

  it("does not mutate the input array", () => {
    const items = [0, 1, 2, 3];
    const copy = [...items];
    seededShuffle(items, "seed");
    expect(items).toEqual(copy);
  });

  it("produces a different order for a different seed (with overwhelming probability)", () => {
    const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const a = seededShuffle(items, "attempt-1:question-1");
    const b = seededShuffle(items, "attempt-1:question-2");
    expect(a).not.toEqual(b);
  });
});
