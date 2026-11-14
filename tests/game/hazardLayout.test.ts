import { describe, expect, it } from "vitest";
import { SAW_W } from "../../src/core/tuning";
import { TRACK_W, worldX } from "../../src/game/three/world";
import {
  spanWorld,
  sawPlace,
  burstPiece,
  BURST_PIECES,
  recruitProgress,
} from "../../src/game/three/hazardLayout";
import { hazardSpan, type Saw } from "../../src/core/track";

describe("hazards in the world", () => {
  it("draws a crate over the span the sim clips", () => {
    const { x, w } = spanWorld(0.2, 0.5);
    expect(x - w / 2).toBeCloseTo(worldX(0.2));
    expect(x + w / 2).toBeCloseTo(worldX(0.5));
  });

  it("puts a saw's disc over its sim span at every distance", () => {
    const saw: Saw = { kind: "saw", pos: 5, mid: 0.5, amp: 0.3, phase: 1 };
    for (const d of [0, 0.4, 1.1, 2.7]) {
      const s = hazardSpan(saw, d);
      const p = sawPlace(saw, d);
      expect(p.x - p.r).toBeCloseTo(worldX(s.left));
      expect(p.x + p.r).toBeCloseTo(worldX(s.right));
      expect(p.r * 2).toBeCloseTo(SAW_W * TRACK_W);
      // the rail holds the whole sweep
      expect(Math.abs(p.x - p.railX) + p.r).toBeLessThanOrEqual(
        p.railW / 2 + 1e-9,
      );
    }
  });

  it("flings burst pieces out from nothing and shrinks them away", () => {
    for (let k = 0; k < BURST_PIECES; k++) {
      const a = burstPiece(k, 0, 2);
      expect(Math.hypot(a.x, a.y, a.z)).toBe(0);
      expect(burstPiece(k, 0.9, 2).size).toBeLessThan(a.size);
    }
    expect(Math.abs(burstPiece(3, 0.5, 2).x)).toBeGreaterThan(0);
  });

  it("sends recruits off staggered, all arrived by the end", () => {
    expect(recruitProgress(0, 10, 0)).toBe(0);
    expect(recruitProgress(9, 10, 0.2)).toBe(0);
    expect(recruitProgress(0, 10, 0.3)).toBeGreaterThan(0);
    for (let k = 0; k < 10; k++) expect(recruitProgress(k, 10, 1)).toBe(1);
  });
});
