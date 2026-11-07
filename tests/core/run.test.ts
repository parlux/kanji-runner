import { describe, expect, it } from "vitest";
import { buildRun } from "../../src/core/run";
import { KANJI } from "../../src/core/kanji";
import { KANA } from "../../src/core/kana";
import { defaultProgress } from "../../src/core/srs";
import { ROWS_PER_RUN, TWO_OPTION_ROWS } from "../../src/core/tuning";
import type { Progress } from "../../src/core/types";

describe("kana data", () => {
  it("has 71 hiragana and 71 katakana with romaji", () => {
    expect(KANA.filter((k) => k.script === "hiragana")).toHaveLength(71);
    expect(KANA.filter((k) => k.script === "katakana")).toHaveLength(71);
    for (const k of KANA) expect(k.romaji).toMatch(/^[a-z]+$/);
  });
});

// hiragana and katakana unlocked, half of them known
const kanaProgress: Progress = { ...defaultProgress(), unlockedLevel: 1 };
KANA.forEach((k, i) => {
  if (i % 2 === 0)
    kanaProgress.items[`${k.char}:kana`] = {
      box: i % 6,
      seen: 1,
      correct: 0,
      wrong: 0,
      lastSeen: 1,
    };
});
const kanaRun = (seed: number) => buildRun(seed, kanaProgress, KANA, KANJI);

describe("buildRun rows", () => {
  it("builds 14 rows with 2 options then 3", () => {
    const rows = kanaRun(1);
    expect(rows).toHaveLength(ROWS_PER_RUN);
    rows.forEach((row, i) => {
      expect(row.options).toHaveLength(i < TWO_OPTION_ROWS ? 2 : 3);
    });
  });

  it("is identical for the same seed, different for different seeds", () => {
    expect(kanaRun(123)).toEqual(kanaRun(123));
    expect(kanaRun(1)).not.toEqual(kanaRun(2));
  });

  it("never has duplicate options or a distractor equal to the answer", () => {
    for (let seed = 0; seed < 500; seed++) {
      for (const row of kanaRun(seed)) {
        expect(new Set(row.options).size).toBe(row.options.length);
        expect(row.options[row.answerIndex]).toBe(row.answer);
        expect(row.options.filter((o) => o === row.answer)).toHaveLength(1);
      }
    }
  }, 20_000); // 10k rows of expect() calls; slow under load

  it("answer is the prompt's romaji", () => {
    const byChar = new Map(KANA.map((k) => [k.char, k.romaji]));
    for (const row of kanaRun(5)) {
      expect(row.answer).toBe(byChar.get(row.prompt));
    }
  });

  it("without kana, asks only unlocked kanji as meaning or reading gates", () => {
    const p: Progress = { ...defaultProgress(), unlockedLevel: 3 };
    for (const k of KANJI.filter((x) => x.level <= 3))
      p.items[`${k.char}:meaning`] = {
        box: 3,
        seen: 3,
        correct: 3,
        wrong: 0,
        lastSeen: 1,
      };
    const unlocked = new Set(
      KANJI.filter((k) => k.level <= 3).map((k) => k.char),
    );
    const types = new Set<string>();
    for (const seed of [1, 2, 3])
      for (const row of buildRun(seed, p, [], KANJI)) {
        expect(unlocked.has(row.prompt)).toBe(true);
        types.add(row.type);
      }
    expect(types).toEqual(new Set(["meaning", "reading"]));
  });
});
