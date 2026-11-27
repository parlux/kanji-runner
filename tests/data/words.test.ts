import { describe, expect, it } from "vitest";
import kanjiData from "../../src/data/kanji.json";
import data from "../../src/data/words.json";

type Word = {
  word: string;
  reading: string;
  glosses: string[];
  kind: "single" | "okurigana" | "compound";
  level: number;
};

const words = data as Word[];
const levelOf = new Map(kanjiData.map((k) => [k.char, k.level]));
const KANA = /^[ぁ-ゖァ-ヺー]$/;
const find = (w: string) => words.find((x) => x.word === w);
/** The level of a word's last-taught kanji. */
const lastKanjiLevel = (w: string) =>
  Math.max(...[...w].map((c) => levelOf.get(c) ?? 0));

const expectPresent = (w: string, reading: string) => {
  expect(find(w), w).toMatchObject({ reading });
  expect(find(w)?.level, w).toBeGreaterThanOrEqual(lastKanjiLevel(w));
};

describe("kanji words data (SPEC-word-gates)", () => {
  it("has the everyday words, no earlier than their last kanji", () => {
    expectPresent("一人", "ひとり");
    expectPresent("大人", "おとな");
    expectPresent("お金", "おかね");
  });

  // Newspaper ranking (byFrequency, W2) missed 今日; byUsefulness picks it
  // and the travel words of the themes.
  it("has 今日 きょう", () => expectPresent("今日", "きょう"));
  it("has the travel words 入り口 and 毎日", () => {
    expectPresent("入り口", "いりぐち");
    expectPresent("毎日", "まいにち");
  });

  it("leaves out usually-kana words and fragments", () => {
    for (const w of ["出来る", "その上"]) expect(find(w), w).toBeUndefined();
  });

  it("leaves out lone kanji read as taught (they only race for the order)", () => {
    const taught = new Map(kanjiData.map((k) => [k.char, k]));
    for (const { word, reading } of words) {
      const k = taught.get(word);
      if (k) expect([k.on, k.kun?.base], word).not.toContain(reading);
    }
    expect(find("駅"), "駅").toBeUndefined();
  });

  it("uses only kanji from kanji.json, kana and 々", () => {
    for (const { word, reading } of words) {
      for (const c of word)
        expect(KANA.test(c) || c === "々" || levelOf.has(c), word).toBe(true);
      expect(
        [...reading].every((c) => KANA.test(c)),
        word,
      ).toBe(true);
    }
  });

  it("fits a gate: word ≤ 6 characters, reading ≤ 7 kana, gloss ≤ 20", () => {
    for (const { word, reading, glosses } of words) {
      expect([...word].length, word).toBeLessThanOrEqual(6);
      expect([...reading].length, word).toBeLessThanOrEqual(7);
      expect(glosses[0]?.length ?? 0, word).toBeGreaterThan(0);
      expect(glosses[0]?.length ?? 99, word).toBeLessThanOrEqual(20);
    }
  });

  // SPEC-overall-progress §2: a word may spill into a later level, never earlier.
  it("puts each word at or after its last kanji's level, in teaching order", () => {
    for (const { word, level } of words)
      expect(level, word).toBeGreaterThanOrEqual(lastKanjiLevel(word));
    const levels = words.map((w) => w.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(new Set(words.map((w) => w.word)).size).toBe(words.length);
  });
});
