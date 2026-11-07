import { describe, expect, it } from "vitest";
import { buildTrack, chargeLine, isCharge } from "../../src/core/track";
import {
  CALM_DISTANCE,
  CHARGE_LINE_DISTANCE,
  ROWS_PER_RUN,
} from "../../src/core/tuning";

const SEEDS = Array.from({ length: 1000 }, (_, seed) => seed);

describe("squad charges on the track", () => {
  it("are questions 4, 8 and 12, never a warm-up", () => {
    const bad = SEEDS.filter((seed) => {
      const t = buildTrack(seed, ROWS_PER_RUN);
      return t.charges.join() !== "3,7,11" || t.charges.some((q) => q < 3);
    });
    expect(bad).toEqual([]);
  });

  it("put the charge line CHARGE_LINE_DISTANCE before the squads, inside the calm stretch", () => {
    expect(CHARGE_LINE_DISTANCE).toBeLessThan(CALM_DISTANCE);
    const bad = SEEDS.filter((seed) => {
      const t = buildTrack(seed, ROWS_PER_RUN);
      return t.charges.some((q) => {
        const line = chargeLine(t, q);
        const pos = t.questions[q] as number;
        return (
          Math.abs(pos - line - CHARGE_LINE_DISTANCE) > 1e-12 ||
          t.hazards.some((h) => h.pos >= line && h.pos <= pos)
        );
      });
    });
    expect(bad).toEqual([]);
  });

  it("don't change the rest of the layout, and can be switched off", () => {
    const on = buildTrack(5, ROWS_PER_RUN);
    const off = buildTrack(5, ROWS_PER_RUN, false);
    expect(off.charges).toEqual([]);
    expect({ ...on, charges: [] }).toEqual(off);
    expect(isCharge(on, 3)).toBe(true);
    expect(isCharge(on, 4)).toBe(false);
    expect(isCharge(off, 3)).toBe(false);
  });

  it("are deterministic per seed", () => {
    expect(buildTrack(9, ROWS_PER_RUN)).toEqual(buildTrack(9, ROWS_PER_RUN));
  });

  it("only include questions that exist in a short run", () => {
    expect(buildTrack(1, 8).charges).toEqual([3, 7]);
    expect(buildTrack(1, 3).charges).toEqual([]);
  });
});
