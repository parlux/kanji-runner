import { describe, expect, it } from "vitest";
import { startLayout, startTap } from "../../src/game/start";

describe("build stamp", () => {
  it("sits at the bottom centre of the start screen, away from Play", () => {
    for (const [w, h] of [
      [390, 844],
      [1280, 800],
    ] as const) {
      const s = startLayout(w, h).stamp;
      expect(s.y + s.h).toBeLessThanOrEqual(h);
      // a tap on the stamp never starts a run
      expect(startTap(false, w, h, w / 2, h - 9, true)).toBeNull();
    }
  });
});
