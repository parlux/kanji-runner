import { describe, expect, it } from "vitest";
import {
  applyCorrect,
  applyCorrectCharge,
  applyWrong,
  applyWrongCharge,
  streakTier,
} from "../../src/core/scoring";
import { SQUAD_DEFECT_GAIN } from "../../src/core/tuning";

describe("applyCorrect", () => {
  // streak passed in is the streak before this answer
  it.each([
    [0, 1, 10 + 3], // streak 1: +base
    [1, 2, 10 + 3], // streak 2: +base
    [2, 3, 10 + 6], // streak 3: +base×2
    [3, 4, 10 + 6], // streak 4: +base×2
    [4, 5, 20], // streak 5: ×2
    [6, 7, 20], // streak 7: ×2
    [7, 8, 30], // streak 8: ×3
  ])(
    "streak %i → %i gives army %i from 10 with base 3",
    (before, after, army) => {
      expect(applyCorrect(10, before, 3)).toEqual({ army, streak: after });
    },
  );

  it("caps ×2 gain at +150", () => {
    expect(applyCorrect(400, 4, 3)).toEqual({ army: 550, streak: 5 });
  });

  it("caps ×3 gain at +150", () => {
    expect(applyCorrect(100, 9, 3)).toEqual({ army: 250, streak: 10 });
  });
});

describe("applyWrong", () => {
  it("loses at least 5", () => {
    expect(applyWrong(10)).toEqual({ army: 5, streak: 0 });
  });

  it("loses 30% rounded up", () => {
    expect(applyWrong(101)).toEqual({ army: 101 - 31, streak: 0 });
  });

  it("floors at 0", () => {
    expect(applyWrong(3)).toEqual({ army: 0, streak: 0 });
  });
});

describe("applyWrongCharge", () => {
  it.each([
    [17, 17 - 9], // 50% of 17 rounds up to 9
    [16, 8], // 50% = 8 = the minimum
    [15, 15 - 8], // 50% rounds up to 8 = the minimum
    [14, 14 - 8], // the minimum beats 50%
    [100, 50],
    [8, 0],
    [3, 0], // floors at 0
  ])("army %i → %i, streak reset", (army, after) => {
    expect(applyWrongCharge(army)).toEqual({ army: after, streak: 0 });
  });
});

describe("applyCorrectCharge", () => {
  it("is the streak reward plus SQUAD_DEFECT_GAIN (10)", () => {
    expect(SQUAD_DEFECT_GAIN).toBe(10);
    expect(applyCorrectCharge(10, 0, 3)).toEqual({ army: 23, streak: 1 });
    expect(applyCorrectCharge(10, 2, 3)).toEqual({ army: 26, streak: 3 });
    expect(applyCorrectCharge(10, 4, 3)).toEqual({ army: 30, streak: 5 });
  });

  it("adds the defectors on top of the +150 cap", () => {
    expect(applyCorrectCharge(400, 4, 3)).toEqual({ army: 560, streak: 5 });
  });
});

describe("streakTier", () => {
  it("follows the payoff table", () => {
    const t = [1, 2, 3, 4, 5, 7, 8, 12].map(streakTier);
    expect(t).toEqual([
      "base",
      "base",
      "double-base",
      "double-base",
      "double",
      "double",
      "triple",
      "triple",
    ]);
  });
});
