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
  expect(find(w), w).toMatchObject({ reading, level: lastKanjiLevel(w) });
};

describe("kanji words data (SPEC-word-gates)", () => {
  it("has the everyday words at their last kanji's level", () => {
    expectPresent("一人", "ひとり");
    expectPresent("大人", "おとな");
    expectPresent("お金", "おかね");
  });

  // Newspaper ranking (byFrequency, W2) missed these; byUsage picks them.
  it("has 今日 きょう", () => expectPresent("今日", "きょう"));
  it("has 入る はいる", () => expectPresent("入る", "はいる"));

  it("leaves out usually-kana words and fragments", () => {
    for (const w of ["出来る", "その上"]) expect(find(w), w).toBeUndefined();
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

  it("gives each word its last kanji's level, in teaching order", () => {
    for (const { word, level } of words)
      expect(level, word).toBe(lastKanjiLevel(word));
    const levels = words.map((w) => w.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(new Set(words.map((w) => w.word)).size).toBe(words.length);
  });

  it("fills levels 2–10 with 30 words each", () => {
    for (let l = 2; l <= 10; l++)
      expect(words.filter((w) => w.level === l).length, `L${l}`).toBe(30);
  });
});
