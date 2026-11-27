import { describe, expect, it } from "vitest";
import type { LevelProgress } from "../../src/core/progression";
import {
  groupedLevelName,
  kindLine,
  unlockLine,
} from "../../src/game/levelcopy";

const p = (over: Partial<LevelProgress> = {}): LevelProgress => ({
  learned: 11,
  total: 15,
  kanji: { learned: 5, total: 7 },
  words: { learned: 6, total: 8 },
  readingToGo: 0,
  ...over,
});

describe("unlockLine", () => {
  it("counts what is left, says next run when done, and marks the last level", () => {
    expect(unlockLine(9 + 1, 4, false)).toBe("4 more to unlock Kanji 10");
    expect(unlockLine(10, 0, false)).toBe("Kanji 10 unlocks next run");
    expect(unlockLine(297, 0, true)).toBe("Last level");
    expect(unlockLine(0, 3, false)).toBe("3 more to unlock Katakana");
  });
});

describe("groupedLevelName", () => {
  it("puts the group before the level", () => {
    expect(groupedLevelName(10)).toBe("Foundations · Kanji 9");
    expect(groupedLevelName(0)).toBe("Kana · Hiragana");
    expect(groupedLevelName(1)).toBe("Kana · Katakana");
  });
});

describe("kindLine", () => {
  it("splits kanji and words", () => {
    expect(kindLine(p())).toBe("Kanji 5/7 · words 6/8");
  });
  it("adds the readings still to learn, singular and plural", () => {
    expect(kindLine(p({ readingToGo: 3 }))).toBe(
      "Kanji 5/7 · words 6/8 · 3 need their reading",
    );
    expect(kindLine(p({ readingToGo: 1 }))).toBe(
      "Kanji 5/7 · words 6/8 · 1 needs its reading",
    );
  });
  it("is absent without words (kana levels, meaning mode)", () => {
    expect(kindLine(p({ words: { learned: 0, total: 0 } }))).toBeNull();
  });
});
