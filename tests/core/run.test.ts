import { describe, expect, it } from "vitest";
import { buildKanaRun } from "../../src/core/run";
import { KANA } from "../../src/core/kana";
import { ROWS_PER_RUN, TWO_OPTION_ROWS } from "../../src/core/tuning";

describe("kana data", () => {
  it("has 71 hiragana and 71 katakana with romaji", () => {
    expect(KANA.filter((k) => k.script === "hiragana")).toHaveLength(71);
    expect(KANA.filter((k) => k.script === "katakana")).toHaveLength(71);
    for (const k of KANA) expect(k.romaji).toMatch(/^[a-z]+$/);
  });
});

describe("buildKanaRun", () => {
  it("builds 20 rows with 2 options then 3", () => {
    const rows = buildKanaRun(1, KANA);
    expect(rows).toHaveLength(ROWS_PER_RUN);
    rows.forEach((row, i) => {
      expect(row.options).toHaveLength(i < TWO_OPTION_ROWS ? 2 : 3);
    });
  });

  it("is identical for the same seed", () => {
    expect(buildKanaRun(123, KANA)).toEqual(buildKanaRun(123, KANA));
  });

  it("differs for different seeds", () => {
    expect(buildKanaRun(1, KANA)).not.toEqual(buildKanaRun(2, KANA));
  });

  it("never has duplicate options or a distractor equal to the answer", () => {
    for (let seed = 0; seed < 500; seed++) {
      for (const row of buildKanaRun(seed, KANA)) {
        expect(new Set(row.options).size).toBe(row.options.length);
        expect(row.options[row.answerIndex]).toBe(row.answer);
        expect(row.options.filter((o) => o === row.answer)).toHaveLength(1);
      }
    }
  }, 20_000); // 10k rows of expect() calls; slow under load

  it("answer is the prompt's romaji", () => {
    const byChar = new Map(KANA.map((k) => [k.char, k.romaji]));
    for (const row of buildKanaRun(5, KANA)) {
      expect(row.answer).toBe(byChar.get(row.prompt));
    }
  });
});
