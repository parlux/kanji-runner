import { describe, expect, it } from "vitest";
import {
  defaultProgress,
  itemKey,
  recordRun,
  review,
  weight,
} from "../../src/core/srs";
import type { GateRow } from "../../src/core/types";

const row = (prompt: string, type: GateRow["type"]): GateRow => ({
  type,
  prompt,
  options: ["x", "y"],
  answerIndex: 0,
  answer: "x",
});

describe("Leitner boxes", () => {
  it("correct moves the box up by 1, capped at 5", () => {
    let item = review(undefined, true, 1);
    expect(item.box).toBe(1);
    for (let i = 0; i < 10; i++) item = review(item, true, 2);
    expect(item.box).toBe(5);
  });

  it("wrong sets the box to 0 from any box", () => {
    let item = review(undefined, true, 1);
    for (let i = 0; i < 4; i++) item = review(item, true, 1);
    expect(review(item, false, 9)).toEqual({
      box: 0,
      seen: 6,
      correct: 5,
      wrong: 1,
      lastSeen: 9,
    });
  });

  it("weight is 2^(5 − box): box 0 is 32× box 5", () => {
    expect([0, 1, 2, 3, 4, 5].map(weight)).toEqual([32, 16, 8, 4, 2, 1]);
    expect(weight(0) / weight(5)).toBe(32);
  });
});

describe("recordRun", () => {
  it("updates each answered row by char:type, in order, and counts the run", () => {
    const rows = [
      row("水", "meaning"),
      row("水", "reading"),
      row("あ", "kana"),
    ];
    const p = recordRun(defaultProgress(), rows, [true, false], false, 5);
    expect(p.items[itemKey("水", "meaning")]?.box).toBe(1);
    expect(p.items[itemKey("水", "reading")]?.box).toBe(0);
    // the army died before the third row: no record
    expect(p.items[itemKey("あ", "kana")]).toBeUndefined();
    expect(p.stats).toEqual({ runs: 1, wins: 0, losses: 1 });
  });

  it("a repeated prompt updates twice, and a finished run is a win", () => {
    const rows = [row("あ", "kana"), row("あ", "kana")];
    const p = recordRun(defaultProgress(), rows, [true, true], true, 5);
    expect(p.items["あ:kana"]).toMatchObject({ box: 2, seen: 2 });
    expect(p.stats.wins).toBe(1);
  });

  it("does not mutate the input", () => {
    const before = defaultProgress();
    recordRun(before, [row("あ", "kana")], [true], true, 1);
    expect(before).toEqual(defaultProgress());
  });
});
