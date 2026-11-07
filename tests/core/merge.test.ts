import { describe, expect, it } from "vitest";
import { mergeProgress } from "../../src/core/merge";
import { createRng, randInt } from "../../src/core/rng";
import type { Rng } from "../../src/core/rng";
import { defaultProgress } from "../../src/core/srs";
import type { ItemProgress, Progress } from "../../src/core/types";

const KEYS = ["あ:kana", "い:kana", "水:meaning", "水:reading", "火:meaning"];

// Small value ranges so lastSeen ties and equal records happen often.
function randomItem(rng: Rng): ItemProgress {
  return {
    box: randInt(rng, 6),
    seen: randInt(rng, 4),
    correct: randInt(rng, 4),
    wrong: randInt(rng, 4),
    lastSeen: randInt(rng, 3),
  };
}

function randomProgress(rng: Rng): Progress {
  const items: Record<string, ItemProgress> = {};
  for (const k of KEYS) if (rng() < 0.6) items[k] = randomItem(rng);
  return {
    version: 1,
    unlockedLevel: randInt(rng, 4),
    items,
    stats: {
      runs: randInt(rng, 5),
      wins: randInt(rng, 5),
      losses: randInt(rng, 5),
    },
  };
}

const CASES = 300;
function forAll(fn: (a: Progress, b: Progress, c: Progress) => void): void {
  const rng = createRng(11);
  for (let i = 0; i < CASES; i++) {
    fn(randomProgress(rng), randomProgress(rng), randomProgress(rng));
  }
}

describe("mergeProgress", () => {
  it("is commutative", () =>
    forAll((a, b) => expect(mergeProgress(a, b)).toEqual(mergeProgress(b, a))));

  it("is idempotent", () =>
    forAll((a, b) => {
      const m = mergeProgress(a, b);
      expect(mergeProgress(m, m)).toEqual(m);
      expect(mergeProgress(m, a)).toEqual(m);
      expect(mergeProgress(m, b)).toEqual(m);
    }));

  it("is associative", () =>
    forAll((a, b, c) =>
      expect(mergeProgress(mergeProgress(a, b), c)).toEqual(
        mergeProgress(a, mergeProgress(b, c)),
      ),
    ));

  it("never loses an item from either side", () =>
    forAll((a, b) => {
      const keys = Object.keys(mergeProgress(a, b).items).sort();
      expect(keys).toEqual(
        [...new Set([...Object.keys(a.items), ...Object.keys(b.items)])].sort(),
      );
    }));

  it("the later lastSeen wins, whole record", () => {
    const old = { box: 5, seen: 9, correct: 9, wrong: 0, lastSeen: 1 };
    const fresh = { box: 0, seen: 2, correct: 1, wrong: 1, lastSeen: 2 };
    const a = { ...defaultProgress(), items: { "水:meaning": old } };
    const b = { ...defaultProgress(), items: { "水:meaning": fresh } };
    expect(mergeProgress(a, b).items["水:meaning"]).toEqual(fresh);
    expect(mergeProgress(b, a).items["水:meaning"]).toEqual(fresh);
  });

  it("takes the max of unlockedLevel and each stat", () => {
    const a = {
      ...defaultProgress(),
      unlockedLevel: 3,
      stats: { runs: 5, wins: 1, losses: 4 },
    };
    const b = {
      ...defaultProgress(),
      unlockedLevel: 2,
      stats: { runs: 3, wins: 2, losses: 1 },
    };
    const m = mergeProgress(a, b);
    expect(m.unlockedLevel).toBe(3);
    expect(m.stats).toEqual({ runs: 5, wins: 2, losses: 4 });
  });

  it("merging with a default progress returns the other side unchanged", () =>
    forAll((a) => {
      expect(mergeProgress(a, defaultProgress())).toEqual(a);
      expect(mergeProgress(defaultProgress(), a)).toEqual(a);
    }));

  it("does not mutate or alias its inputs", () => {
    const rng = createRng(5);
    const a = randomProgress(rng);
    const snapshot = structuredClone(a);
    const m = mergeProgress(a, defaultProgress());
    for (const k of Object.keys(m.items))
      expect(m.items[k]).not.toBe(a.items[k]);
    expect(a).toEqual(snapshot);
  });
});
