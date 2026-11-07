import { describe, expect, it } from "vitest";
import {
  bossSize,
  bossWon,
  clashAt,
  expectedBossArmy,
  scorePass,
} from "../../src/core/boss";
import { buildTrack } from "../../src/core/track";
import { CLASH_SECONDS, ROWS_PER_RUN } from "../../src/core/tuning";
import { kanaRun } from "./kana-run";

const rows = kanaRun(3);
const charges = buildTrack(3, ROWS_PER_RUN).charges;

describe("boss sizing", () => {
  it("is deterministic for a seed and run", () => {
    expect(bossSize(rows, charges, 3)).toBe(bossSize(rows, charges, 3));
    expect(bossSize(rows, charges, 3)).toBeGreaterThan(0);
  });

  it("sits between an all-wrong and a perfect pass", () => {
    const perfect = scorePass(rows, charges, () => false);
    const e = expectedBossArmy(rows, charges, 3);
    expect(e).toBeGreaterThan(0);
    expect(e).toBeLessThan(perfect);
    expect(scorePass(rows, charges, () => true)).toBe(0);
  });

  it("counts squad shapes: charges change the expected army", () => {
    const perfect = scorePass(rows, charges, () => false);
    expect(scorePass(rows, [], () => false)).toBeLessThan(perfect);
  });
});

describe("clash", () => {
  it("a tie is a loss", () => {
    expect(bossWon(40, 40)).toBe(false);
    expect(bossWon(41, 40)).toBe(true);
    expect(clashAt(40, 40, CLASH_SECONDS)).toEqual({
      army: 0,
      boss: 0,
      done: true,
    });
  });

  it("ticks both sides down by the same amount until one is at 0", () => {
    const mid = clashAt(100, 60, CLASH_SECONDS / 2);
    expect(mid).toEqual({ army: 70, boss: 30, done: false });
    expect(clashAt(100, 60, 0)).toEqual({ army: 100, boss: 60, done: false });
    expect(clashAt(100, 60, CLASH_SECONDS * 2)).toEqual({
      army: 40,
      boss: 0,
      done: true,
    });
    expect(clashAt(20, 50, CLASH_SECONDS).army).toBe(0);
  });
});
