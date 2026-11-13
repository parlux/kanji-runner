import { describe, expect, it } from "vitest";
import { HORDE_SCALE } from "../../src/core/tuning";
import {
  FIGURE_RADIUS,
  HORDE_CAP,
  HORDE_DEPTH_MAX,
  hordeDepth,
  hordeOffset,
  hordeScales,
  TRACK_W,
} from "../../src/game/three/world";

describe("horde layout", () => {
  const scale = HORDE_SCALE;

  it("keeps 200, 2,000 and 20,000 figures inside the span and the depth, whole or shot down", () => {
    for (const heads of [200, 2_000, 20_000])
      for (const share of [1, 0.5, 0.05, 1 / heads])
        for (const span of [1, 0.4, 0.08]) {
          const n = Math.max(1, Math.round(heads * share));
          const { sx, sz } = hordeScales(n, heads, span, 1, scale);
          const half = (span * TRACK_W) / 2;
          const deep = hordeDepth(heads, TRACK_W, scale) / 2;
          let wide = 0;
          let far = 0;
          for (let k = 0; k < n; k++) {
            const o = hordeOffset(k);
            wide = Math.max(wide, Math.abs(o.x * sx));
            far = Math.max(far, Math.abs(o.z * sz));
          }
          expect(wide + FIGURE_RADIUS * scale).toBeLessThan(half + 1e-6);
          expect(far).toBeLessThanOrEqual(deep + 1e-6);
        }
  });

  it("is deep but well short of a gate row, and denser as the count grows", () => {
    const d200 = hordeDepth(200, TRACK_W, scale);
    const d2k = hordeDepth(2_000, TRACK_W, scale);
    const d20k = hordeDepth(20_000, TRACK_W, scale);
    expect(d200).toBeGreaterThanOrEqual(0.4 * TRACK_W);
    expect(d2k).toBeGreaterThan(d200);
    expect(d20k).toBe(HORDE_DEPTH_MAX);
    expect(HORDE_DEPTH_MAX).toBeLessThanOrEqual(1.2 * TRACK_W);
    expect(2_000 / d2k).toBeGreaterThan(200 / d200);
    expect(20_000 / d20k).toBeGreaterThan(2_000 / d2k);
  });

  it("does not stack a 200 pack's figures", () => {
    const { sx, sz } = hordeScales(200, 200, 1, 1, scale);
    let closest = Infinity;
    for (let a = 0; a < 200; a++)
      for (let b = a + 1; b < 200; b++) {
        const p = hordeOffset(a);
        const q = hordeOffset(b);
        closest = Math.min(
          closest,
          Math.hypot((p.x - q.x) * sx, (p.z - q.z) * sz),
        );
      }
    expect(closest).toBeGreaterThan(FIGURE_RADIUS * scale);
  });

  it("is finite up to the cap, and empty for no figures", () => {
    const o = hordeOffset(HORDE_CAP - 1);
    expect(Number.isFinite(o.x) && Number.isFinite(o.z)).toBe(true);
    expect(hordeScales(0, 200, 1, 1, scale)).toEqual({ sx: 0, sz: 0 });
  });
});
