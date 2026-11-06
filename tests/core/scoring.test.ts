import { describe, expect, it } from "vitest";
import { applyCorrect, applyWrong } from "../../src/core/scoring";

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
