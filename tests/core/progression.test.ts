import { describe, expect, it } from "vitest";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import {
  applyUnlock,
  levelKeys,
  levelName,
  levelProgress,
  maxLevel,
  meaningProgress,
  place,
  placeMeaning,
} from "../../src/core/progression";
import { defaultProgress, itemKey } from "../../src/core/srs";
import { WORDS } from "../../src/core/words";
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
  it("placing at level 1 marks all kana box 4 and unlocks kanji level 2", () => {
    const p = place(defaultProgress(), 1, KANA, KANJI);
    expect(p.unlockedLevel).toBe(2);
    for (const k of KANA) expect(p.items[`${k.char}:kana`]?.box).toBe(4);
    expect(p.items["日:meaning"]).toBeUndefined();
  });

  it("placing at level N unlocks N + 1 and never lowers an existing box", () => {
    const start = defaultProgress();
    start.items["日:meaning"] = rec(4);
    start.items["一:meaning"] = rec(0);
    const p = place(start, 3, KANA, KANJI);
    expect(p.unlockedLevel).toBe(4);
    expect(p.items["日:meaning"]).toEqual(rec(4));
    expect(p.items["一:meaning"]).toEqual(rec(4));
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

describe("words and progression", () => {
  const wordKey = (w: { word: string }) => itemKey(w.word, "word");

  it("place marks words of placed levels at box 4, never lowers", () => {
    const first = WORDS[0] as (typeof WORDS)[number]; // level 2
    const high = WORDS.find((w) => w.level === 5) as (typeof WORDS)[number];
    const p = place(defaultProgress(), 3, KANA, KANJI, WORDS);
    for (const w of WORDS)
      expect(p.items[wordKey(w)]?.box).toBe(w.level <= 3 ? 4 : undefined);
    expect(p.items[wordKey(first)]?.seen).toBe(0);
    const q: Progress = {
      ...defaultProgress(),
      items: { [wordKey(first)]: rec(5), [wordKey(high)]: rec(1, 2) },
    };
    const r = place(q, 4, KANA, KANJI, WORDS);
    expect(r.items[wordKey(first)]?.box).toBe(5);
  });

  it("re-placement lower removes unanswered word marks, keeps answered", () => {
    const answered = WORDS.find((w) => w.level === 4) as (typeof WORDS)[number];
    const high = place(defaultProgress(), 5, KANA, KANJI, WORDS);
    high.items[wordKey(answered)] = rec(4, 3);
    const low = place(high, 2, KANA, KANJI, WORDS);
    for (const w of WORDS) {
      if (w.level > 3 && w !== answered)
        expect(low.items[wordKey(w)]).toBeUndefined();
    }
    expect(low.items[wordKey(answered)]?.seen).toBe(3);
  });

  it("level unlock ignores words", () => {
    expect(levelKeys(3, KANA, KANJI).some((k) => k.endsWith(":word"))).toBe(
      false,
    );
    const p = withLearned(2, 24);
    for (const w of WORDS) p.items[wordKey(w)] = rec(0);
    expect(applyUnlock(p, KANA, KANJI).unlockedLevel).toBe(3);
    const q = withLearned(2, 23);
    for (const w of WORDS) q.items[wordKey(w)] = rec(5);
    expect(applyUnlock(q, KANA, KANJI).unlockedLevel).toBe(2);
  });
});

describe("meaning-mode progress", () => {
  it("starts fresh at Kanji 1 (level 2) with no records", () => {
    const p = meaningProgress();
    expect(p.unlockedLevel).toBe(2);
    expect(p.items).toEqual({});
    expect(levelName(p.unlockedLevel)).toBe("Kanji 1");
  });

  it("places from Kanji 1 up and never creates kana records", () => {
    const none = placeMeaning(meaningProgress(), 1, KANJI);
    expect(none.unlockedLevel).toBe(2);
    expect(none.items).toEqual({});
    // below the floor behaves like the floor
    expect(placeMeaning(meaningProgress(), -1, KANJI).unlockedLevel).toBe(2);
    const p = placeMeaning(meaningProgress(), 4, KANJI);
    expect(p.unlockedLevel).toBe(5);
    const keys = Object.keys(p.items);
    expect(keys.length).toBe(90);
    expect(keys.every((k) => k.endsWith(":meaning"))).toBe(true);
  });

  it("unlocks by the 80% rule from Kanji 1, counting meanings only", () => {
    const p = meaningProgress();
    for (const key of levelKeys(2, [], KANJI).slice(0, 24))
      p.items[key] = rec(2);
    expect(applyUnlock(p, [], KANJI).unlockedLevel).toBe(3);
    const short = meaningProgress();
    for (const key of levelKeys(2, [], KANJI).slice(0, 23))
      short.items[key] = rec(2);
    expect(applyUnlock(short, [], KANJI).unlockedLevel).toBe(2);
  });
});
