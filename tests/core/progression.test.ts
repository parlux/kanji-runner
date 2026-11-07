import { describe, expect, it } from "vitest";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import {
  applyUnlock,
  levelKeys,
  levelName,
  levelProgress,
  maxLevel,
  place,
} from "../../src/core/progression";
import { defaultProgress } from "../../src/core/srs";
import type { ItemProgress, Progress } from "../../src/core/types";

const rec = (box: number, seen = 1): ItemProgress => ({
  box,
  seen,
  correct: 0,
  wrong: 0,
  lastSeen: 1,
});

/** Progress at `level` with the first `learned` of its items at box 2. */
function withLearned(level: number, learned: number): Progress {
  const p: Progress = { ...defaultProgress(), unlockedLevel: level };
  levelKeys(level, KANA, KANJI).forEach((k, i) => {
    p.items[k] = rec(i < learned ? 2 : 1);
  });
  return p;
}

describe("levels", () => {
  it("level 0 is hiragana, 1 katakana, 2+ kanji in 30s", () => {
    expect(levelKeys(0, KANA, KANJI)).toContain("あ:kana");
    expect(levelKeys(1, KANA, KANJI)).toContain("ア:kana");
    expect(levelKeys(0, KANA, KANJI)).not.toContain("ア:kana");
    expect(levelKeys(2, KANA, KANJI)).toHaveLength(30);
    expect(levelKeys(2, KANA, KANJI)[0]).toBe("日:meaning");
    expect(maxLevel(KANJI)).toBe(73);
  });

  it("has human names", () => {
    expect([0, 1, 2, 3].map(levelName)).toEqual([
      "Hiragana",
      "Katakana",
      "Kanji 1",
      "Kanji 2",
    ]);
  });

  it("counts learned items at box ≥ 2 of the primary type only", () => {
    const p = withLearned(2, 10);
    p.items["日:reading"] = rec(5);
    expect(levelProgress(p, 2, KANA, KANJI)).toEqual({
      learned: 10,
      total: 30,
      needed: 24,
    });
  });
});

describe("unlock rule", () => {
  it("unlocks the next kanji level at exactly 80% (24/30), not at 23/30", () => {
    expect(applyUnlock(withLearned(2, 23), KANA, KANJI).unlockedLevel).toBe(2);
    expect(applyUnlock(withLearned(2, 24), KANA, KANJI).unlockedLevel).toBe(3);
  });

  it("unlocks katakana at 57/71 hiragana (80% rounded up), not 56", () => {
    const total = levelKeys(0, KANA, KANJI).length;
    expect(total).toBe(71);
    expect(applyUnlock(withLearned(0, 56), KANA, KANJI).unlockedLevel).toBe(0);
    expect(applyUnlock(withLearned(0, 57), KANA, KANJI).unlockedLevel).toBe(1);
  });

  it("keeps the same object when nothing unlocks, and never lowers", () => {
    const p = withLearned(5, 0);
    expect(applyUnlock(p, KANA, KANJI)).toBe(p);
  });

  it("stops at the last level", () => {
    const p = withLearned(73, 30);
    expect(applyUnlock(p, KANA, KANJI).unlockedLevel).toBe(73);
  });
});

describe("placement", () => {
  it("placing at level 1 marks all kana box 2 and unlocks kanji level 2", () => {
    const p = place(defaultProgress(), 1, KANA, KANJI);
    expect(p.unlockedLevel).toBe(2);
    for (const k of KANA) expect(p.items[`${k.char}:kana`]?.box).toBe(2);
    expect(p.items["日:meaning"]).toBeUndefined();
  });

  it("placing at level N unlocks N + 1 and never lowers an existing box", () => {
    const start = defaultProgress();
    start.items["日:meaning"] = rec(4);
    start.items["一:meaning"] = rec(0);
    const p = place(start, 3, KANA, KANJI);
    expect(p.unlockedLevel).toBe(4);
    expect(p.items["日:meaning"]).toEqual(rec(4));
    expect(p.items["一:meaning"]).toEqual(rec(2));
    for (const l of [0, 1, 2, 3])
      expect(levelProgress(p, l, KANA, KANJI).learned).toBe(
        levelKeys(l, KANA, KANJI).length,
      );
  });

  it("re-picking lower undoes unanswered placement marks above it", () => {
    const high = place(defaultProgress(), 4, KANA, KANJI);
    const firstOfLevel3 = levelKeys(3, KANA, KANJI)[0] as string;
    high.items[firstOfLevel3] = rec(2, 3); // answered after placement
    const low = place(high, 1, KANA, KANJI);
    expect(low.unlockedLevel).toBe(2);
    expect(low.items["日:meaning"]).toBeUndefined();
    expect(low.items[firstOfLevel3]).toEqual(rec(2, 3));
    // and the next run's unlock check does not jump straight back up
    expect(applyUnlock(low, KANA, KANJI).unlockedLevel).toBe(2);
    expect(place(high, -1, KANA, KANJI).unlockedLevel).toBe(0);
  });

  it("clamps to the last level", () => {
    expect(place(defaultProgress(), 99, KANA, KANJI).unlockedLevel).toBe(73);
  });
});
