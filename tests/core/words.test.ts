import { describe, expect, it } from "vitest";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import { maxLevel } from "../../src/core/progression";
import { defaultProgress } from "../../src/core/srs";
import type { Progress, WordItem } from "../../src/core/types";
import {
  assignLevels,
  isWordEligible,
  kanaNeeded,
  WORDS,
} from "../../src/core/words";
import data from "../../src/data/loanwords.json";

describe("loanwords.json", () => {
  const allowed = new Set([
    ...KANA.filter((k) => k.script === "katakana").map((k) => k.char),
    ..."ァィゥェォッャュョー",
  ]);

  it("has at least 150 entries", () => {
    expect(data.length).toBeGreaterThanOrEqual(150);
  });

  it("uses only katakana, small kana and ー, no ヴ", () => {
    const bad = data.filter((e) => [...e.word].some((c) => !allowed.has(c)));
    expect(bad).toEqual([]);
    expect(allowed.has("ヴ")).toBe(false);
  });

  it("words are 2–6 characters", () => {
    const bad = data.filter(
      (e) => [...e.word].length < 2 || [...e.word].length > 6,
    );
    expect(bad).toEqual([]);
  });

  it("first glosses fit a gate label (≤ 14 characters)", () => {
    expect(data.filter((e) => (e.glosses[0] ?? "").length > 14)).toEqual([]);
  });

  it("words are unique", () => {
    expect(new Set(data.map((e) => e.word)).size).toBe(data.length);
  });

  it("every word has glosses and no gloss is shared between words", () => {
    const owner = new Map<string, string>();
    const clashes: string[] = [];
    for (const e of data) {
      expect(e.glosses.length).toBeGreaterThan(0);
      for (const g of new Set(e.glosses.map((g) => g.toLowerCase()))) {
        const prev = owner.get(g);
        if (prev !== undefined) clashes.push(`${g}: ${prev} ${e.word}`);
        owner.set(g, e.word);
      }
    }
    expect(clashes).toEqual([]);
  });
});

describe("kanaNeeded", () => {
  it("drops ー", () => {
    expect(kanaNeeded("コーヒー")).toEqual(["コ", "ヒ"]);
  });

  it("maps small kana to full size", () => {
    expect(kanaNeeded("チャンピオン")).toEqual(["チ", "ヤ", "ン", "ピ", "オ"]);
    expect(kanaNeeded("ティッシュ")).toEqual(["テ", "イ", "ツ", "シ", "ユ"]);
    expect(kanaNeeded("ァィゥェォッャュョ")).toEqual([..."アイウエオツヤユヨ"]);
  });

  it("every word's kana are in kana.json", () => {
    const kana = new Set(KANA.map((k) => k.char));
    for (const w of WORDS)
      for (const c of kanaNeeded(w.word)) expect(kana.has(c)).toBe(true);
  });
});

describe("level assignment", () => {
  const entries = Array.from({ length: 12 }, (_, i) => ({
    word: `w${i}`,
    glosses: [`g${i}`],
  }));

  it("puts WORDS_PER_LEVEL (5) words on each level from 2", () => {
    expect(assignLevels(entries, 30).map((w) => w.level)).toEqual([
      2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4,
    ]);
  });

  it("caps at the last level", () => {
    expect(assignLevels(entries, 3).map((w) => w.level)).toEqual([
      2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3,
    ]);
  });

  it("the real list starts at level 2 and stays within the kanji levels", () => {
    expect(WORDS[0]?.level).toBe(2);
    expect(WORDS[4]?.level).toBe(2);
    expect(WORDS[5]?.level).toBe(3);
    const top = maxLevel(KANJI);
    expect(WORDS.every((w) => w.level >= 2 && w.level <= top)).toBe(true);
  });
});

describe("isWordEligible", () => {
  const coffee: WordItem = { word: "コーヒー", glosses: ["coffee"], level: 3 };
  const at = (box: number) => ({
    box,
    seen: 1,
    correct: 0,
    wrong: 0,
    lastSeen: 1,
  });
  const progress = (level: number, boxes: Record<string, number>): Progress => {
    const p: Progress = { ...defaultProgress(), unlockedLevel: level };
    for (const [c, b] of Object.entries(boxes)) p.items[`${c}:kana`] = at(b);
    return p;
  };

  it("needs the level unlocked and every kana learned", () => {
    expect(isWordEligible(coffee, progress(3, { コ: 2, ヒ: 5 }))).toBe(true);
    expect(isWordEligible(coffee, progress(9, { コ: 2, ヒ: 2 }))).toBe(true);
  });

  it("is not eligible before its level", () => {
    expect(isWordEligible(coffee, progress(2, { コ: 5, ヒ: 5 }))).toBe(false);
  });

  it("is not eligible with a kana below LEARNED_BOX or unseen", () => {
    expect(isWordEligible(coffee, progress(3, { コ: 5, ヒ: 1 }))).toBe(false);
    expect(isWordEligible(coffee, progress(3, { コ: 5 }))).toBe(false);
  });

  it("checks small kana as full size", () => {
    const tissue: WordItem = { word: "ティッシュ", glosses: ["t"], level: 2 };
    const learned = { テ: 2, イ: 2, シ: 2, ツ: 2 };
    expect(isWordEligible(tissue, progress(2, learned))).toBe(false);
    expect(isWordEligible(tissue, progress(2, { ...learned, ユ: 2 }))).toBe(
      true,
    );
  });
});
