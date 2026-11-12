import { describe, expect, it } from "vitest";
import { crowdWidth } from "../../src/core/crowd";
import { CROWD_MAX_W, VIEW_DISTANCE } from "../../src/core/tuning";
import {
  CROWD_DEPTH,
  crowdLayout,
  FIGURE_RADIUS,
  FOG_TOP_H,
  fogRange,
  MAX_DRAWN_SOLDIERS,
  TRACK_W,
  trackDist,
  trackX,
  viewDepth,
  worldX,
  worldZ,
  screenAt,
  type CameraPose,
} from "../../src/game/three/world";
import { AIM, CAMERA_MIN_HEIGHT, cameraFit } from "../../src/game/three/view";

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
});

describe("camera fit", () => {
  const sizes: [number, number][] = [
    [390, 844],
    [1280, 800],
  ];
  const fogZ = worldZ(VIEW_DISTANCE, 0);

  for (const [w, h] of sizes)
    it(`at ${w}×${h} puts the army low, the fog line high and both edges in view`, () => {
      const aspect = w / h;
      const fit = cameraFit(aspect);
      expect(screenAt(fit, aspect, 0, 0, 0).y).toBeCloseTo(AIM.armyY, 6);
      expect(screenAt(fit, aspect, 0, 0, fogZ).y).toBeCloseTo(AIM.fogY, 6);
      const army = screenAt(fit, aspect, 0, 0, 0).y;
      const fog = screenAt(fit, aspect, 0, 0, fogZ).y;
      expect(army).toBeGreaterThanOrEqual(0.78);
      expect(army).toBeLessThanOrEqual(0.86);
      expect(fog).toBeGreaterThanOrEqual(0.18);
      expect(fog).toBeLessThanOrEqual(0.28);
      for (const x of [0, 1]) {
        const p = screenAt(fit, aspect, worldX(x), 0, 0).x;
        expect(p).toBeGreaterThan(0);
        expect(p).toBeLessThan(1);
      }
      // the biggest crowd's near edge stays on screen
      const nearZ = (CROWD_MAX_W / 2) * CROWD_DEPTH * TRACK_W;
      expect(screenAt(fit, aspect, 0, 0, nearZ).y).toBeLessThan(1);
      // real perspective: the track at the fog line is narrower than at the army
      const near = screenAt(fit, aspect, worldX(1), 0, 0).x - 0.5;
      const far = screenAt(fit, aspect, worldX(1), 0, fogZ).x - 0.5;
      expect(far).toBeLessThan(near * 0.7);
      // the fog stays total by VIEW_DISTANCE with this pose
      const { far: fogEnd } = fogRange(fit.pose);
      expect(
        viewDepth(fit.pose, 0, worldZ(VIEW_DISTANCE + 0.01, 0)),
      ).toBeGreaterThan(fogEnd);
    });

  it("raises the camera only when the screen is too narrow", () => {
    expect(cameraFit(1280 / 800).pose.height).toBe(CAMERA_MIN_HEIGHT);
    expect(cameraFit(390 / 844).pose.height).toBeGreaterThan(CAMERA_MIN_HEIGHT);
  });
});
