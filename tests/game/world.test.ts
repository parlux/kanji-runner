import { describe, expect, it } from "vitest";
import { crowdWidth } from "../../src/core/crowd";
import { VIEW_DISTANCE } from "../../src/core/tuning";
import {
  crowdLayout,
  FIGURE_RADIUS,
  fitFov,
  FOG_TOP_H,
  fogRange,
  MAX_DRAWN_SOLDIERS,
  TRACK_W,
  trackDist,
  trackX,
  viewDepth,
  worldX,
  worldZ,
  type CameraPose,
} from "../../src/game/three/world";

const pose: CameraPose = { height: 4, back: 12, lookAhead: 20, lookHeight: 0 };

describe("track ↔ world mapping", () => {
  it("round-trips track x and distance", () => {
    for (const x of [0, 0.13, 0.5, 0.9, 1]) expect(trackX(worldX(x))).toBe(x);
    for (const d of [0, 1.25, 7.5]) expect(trackDist(worldZ(d, 3), 3)).toBe(d);
  });

  it("spans the track width, centred, with the army at Z = 0 running to −Z", () => {
    expect(worldX(0)).toBe(-TRACK_W / 2);
    expect(worldX(1)).toBe(TRACK_W / 2);
    expect(worldZ(4, 4)).toBe(-0);
    expect(worldZ(5, 4)).toBeLessThan(0);
  });
});

describe("crowd layout", () => {
  const out = new Float32Array(2 * MAX_DRAWN_SOLDIERS);

  it("draws one figure per soldier, capped at MAX_DRAWN_SOLDIERS", () => {
    expect(crowdLayout(5, out)).toBe(5);
    expect(crowdLayout(40, out)).toBe(40);
    expect(crowdLayout(200, out)).toBe(200);
    expect(crowdLayout(1000, out)).toBe(MAX_DRAWN_SOLDIERS);
    expect(crowdLayout(0, out)).toBe(0);
  });

  it("keeps every figure inside the crowd's width", () => {
    for (const army of [1, 5, 40, 200, 1000]) {
      const n = crowdLayout(army, out);
      const half = (crowdWidth(army) * TRACK_W) / 2;
      for (let k = 0; k < n; k++)
        expect(Math.abs(out[2 * k] as number) + FIGURE_RADIUS).toBeLessThan(
          half + 1e-9,
        );
    }
  });

  it("is the same for the same army size", () => {
    const a = new Float32Array(400);
    const b = new Float32Array(400);
    crowdLayout(40, a);
    crowdLayout(77, b);
    crowdLayout(40, b);
    expect(Array.from(b.subarray(0, 80))).toEqual(
      Array.from(a.subarray(0, 80)),
    );
  });
});

describe("fog and camera", () => {
  it("is total by VIEW_DISTANCE for anything up to FOG_TOP_H tall", () => {
    const { near, far } = fogRange(pose);
    expect(near).toBeLessThan(far);
    const z = worldZ(VIEW_DISTANCE, 0);
    expect(Math.min(viewDepth(pose, 0, z), viewDepth(pose, FOG_TOP_H, z))).toBe(
      far,
    );
    // just beyond it, nothing on the track is in front of the fog's end
    const beyond = worldZ(VIEW_DISTANCE + 0.01, 0);
    for (const y of [0, FOG_TOP_H / 2, FOG_TOP_H])
      expect(viewDepth(pose, y, beyond)).toBeGreaterThan(far);
  });

  it("widens the view on a narrow screen to show both track edges at the army", () => {
    const aspect = 390 / 844;
    const fov = fitFov(pose, aspect, 40, 1.05);
    const tanH = Math.tan(((fov / 2) * Math.PI) / 180) * aspect;
    expect(TRACK_W / 2 / viewDepth(pose, 0, 0)).toBeLessThan(tanH);
    // a wide screen keeps the base field of view
    expect(fitFov(pose, 1280 / 800, 40, 1.05)).toBe(40);
  });
});
