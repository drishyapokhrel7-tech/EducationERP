/**
 * Deterministic shuffle: the same seed always produces the same
 * permutation. Used to randomize question and option order per exam
 * attempt without persisting a "shuffled order" field — every fetch of
 * the same in-progress attempt re-derives the identical order, so a
 * page refresh never reshuffles what the student is looking at.
 */

// mulberry32 — a small, fast, seeded PRNG. Not cryptographic; doesn't
// need to be, this is display ordering, not a security control.
function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return hash;
}

/** Fisher–Yates, driven by a seeded PRNG — returns a new array. */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  const random = mulberry32(stringToSeed(seed));
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
