import { describe, expect, it } from "vitest";
import { gateReached, plannedRows } from "../../src/core/sim";
import { botRun } from "./bot";
import { wkRun } from "./wk-run";

/** Longest run of `true` in a list. */
function longest(results: boolean[]): number {
  let best = 0;
  let cur = 0;
  for (const r of results) {
    cur = r ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  return best;
}

describe("best streak", () => {
  it("is 0 when nothing was answered right", () => {
    const s = botRun(1, { wrong: () => true });
    expect(s.results.some(Boolean)).toBe(false);
    expect(s.bestStreak).toBe(0);
  });

  it("is the longest run, not the last one", () => {
    // right x4, wrong, right x2, wrong, right x1 ...
    const wrongAt = new Set([4, 7, 9]);
    const s = botRun(2, { wrong: (q) => wrongAt.has(q) || q >= 12 });
    expect(s.results.slice(0, 10)).toEqual([
      true,
      true,
      true,
      true,
      false,
      true,
      true,
      false,
      true,
      false,
    ]);
    expect(s.bestStreak).toBe(longest(s.results));
    expect(s.bestStreak).toBeGreaterThanOrEqual(4);
    expect(s.bestStreak).toBe(4);
    expect(s.streak).toBe(0);
  });

  it("equals the longest run of right answers across re-asks", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = botRun(seed, {
        wrong: (q) => q % 5 === 2,
        build: wkRun,
      });
      expect(s.reask).not.toBeNull();
      expect(s.bestStreak).toBe(longest(s.results));
    }
  });
});

describe("gateReached", () => {
  it("is the answered gates out of the planned rows", () => {
    const s = botRun(3, { wrong: () => false });
    expect(gateReached(s)).toEqual({
      gate: s.results.length,
      of: plannedRows(s).length,
    });
  });

  it("counts the gate an army died at", () => {
    const s = botRun(1, { wrong: () => true });
    expect(s.status).toBe("dead");
    expect(gateReached(s).gate).toBe(s.results.length);
    expect(gateReached(s).gate).toBeLessThanOrEqual(gateReached(s).of);
  });
});
