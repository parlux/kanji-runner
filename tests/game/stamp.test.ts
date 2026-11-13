import { describe, expect, it } from "vitest";
import {
  STAMP_TAPS,
  STAMP_WINDOW,
  stampTap,
  stampTapped,
  startLayout,
  startTap,
} from "../../src/game/start";

describe("build stamp taps", () => {
  const run = (times: number[]): boolean[] => {
    let taps: number[] = [];
    return times.map((t) => {
      const r = stampTapped(taps, t);
      taps = r.taps;
      return r.toggle;
    });
  };

  it("toggles on the fifth tap within 3 s, then starts over", () => {
    expect(run([0, 0.5, 1, 1.5, 2])).toEqual([
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(run([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9])).toEqual([
      false,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(STAMP_TAPS).toBe(5);
    expect(STAMP_WINDOW).toBe(3);
  });

  it("does not toggle when the taps are spread over more than 3 s", () => {
    expect(run([0, 1, 2, 3.5, 4])).toEqual([false, false, false, false, false]);
    expect(run([0, 1, 2, 3, 3.01])).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("sits at the bottom centre of the start screen, away from Play", () => {
    for (const [w, h] of [
      [390, 844],
      [1280, 800],
    ] as const) {
      const s = startLayout(w, h).stamp;
      expect(stampTap(w, h, w / 2, h - 9)).toBe(true);
      expect(stampTap(w, h, w / 2, h / 2)).toBe(false);
      expect(s.y + s.h).toBeLessThanOrEqual(h);
      // a stamp tap never starts a run
      expect(startTap(false, w, h, w / 2, h - 9, true)).toBeNull();
    }
  });
});
