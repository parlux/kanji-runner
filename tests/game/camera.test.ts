import { describe, expect, it } from "vitest";
import {
  CALM_DISTANCE,
  CROWD_MAX_W,
  HAZARD_SPACING,
  REASK_GAP_MIN,
  VIEW_DISTANCE,
} from "../../src/core/tuning";
import {
  CROWD_DEPTH,
  FOG_TOP_H,
  SHAPE_DISTANCE,
  TRACK_W,
  worldX,
  worldZ,
  HAZE_MAX,
  shapeDistance,
} from "../../src/game/three/world";
import {
  fogRange,
  hazeAt,
  viewDepth,
  screenAt,
  type CameraPose,
  followStep,
  followTarget,
  poseFromSettings,
  DEFAULT_CAMERA,
  type CameraSettings,
} from "../../src/game/three/camera";
import { WALL_H } from "../../src/game/three/wallLayout";
import { AIM, cameraFor } from "../../src/game/three/view";

const pose: CameraPose = { height: 4, back: 12, lookAhead: 20, lookHeight: 0 };

describe("haze and horizons", () => {
  const poses = [pose, cameraFor().pose, cameraFor().pose];
  const haze = (p: CameraPose, ahead: number, y: number): number =>
    hazeAt(fogRange(p), viewDepth(p, y, worldZ(ahead, 0)));

  it("is near-total at SHAPE_DISTANCE and near-none at VIEW_DISTANCE", () => {
    for (const p of poses)
      for (const y of [0, WALL_H, FOG_TOP_H]) {
        expect(haze(p, SHAPE_DISTANCE, y)).toBeGreaterThan(0.97);
        expect(haze(p, VIEW_DISTANCE, y)).toBeLessThan(0.05);
        // shapes are already gone as they cross the shape horizon: no pop-in
        expect(haze(p, SHAPE_DISTANCE + 0.01, y)).toBe(1);
      }
  });

  it("thins steadily as a shape comes closer, with no jump", () => {
    for (const p of poses) {
      let last = 1;
      for (let a = SHAPE_DISTANCE; a >= VIEW_DISTANCE; a -= 0.05) {
        const h = haze(p, a, WALL_H / 2);
        expect(h).toBeLessThanOrEqual(last);
        expect(last - h).toBeLessThan(0.03);
        last = h;
      }
    }
  });

  it("keeps SHAPE_DISTANCE below the closest a re-ask can replace a row", () => {
    expect(SHAPE_DISTANCE).toBeGreaterThan(VIEW_DISTANCE);
    expect(SHAPE_DISTANCE).toBeLessThan(
      REASK_GAP_MIN * (CALM_DISTANCE + 2 * HAZARD_SPACING),
    );
  });
});

describe("default camera", () => {
  const sizes: [number, number][] = [
    [390, 844],
    [1280, 800],
  ];
  const viewZ = worldZ(VIEW_DISTANCE, 0);
  const pitchOf = (p: CameraPose): number =>
    (Math.atan2(p.height - p.lookHeight, p.back + p.lookAhead) * 180) / Math.PI;

  it("is the owner's pick: pitch 8, distance 15, FOV 34, follow 0.4, smoothing 1", () => {
    expect(DEFAULT_CAMERA).toMatchObject({
      pitch: 8,
      distance: 15,
      fov: 34,
      follow: 0.4,
      smoothing: 1,
    });
    const fit = cameraFor();
    expect(fit).toEqual(poseFromSettings(DEFAULT_CAMERA, AIM.armyY));
    expect(pitchOf(fit.pose)).toBeCloseTo(8, 9);
    expect(Math.hypot(fit.pose.height, fit.pose.back)).toBeCloseTo(15, 9);
    expect(fit.fov).toBe(34);
  });

  for (const [w, h] of sizes)
    it(`at ${w}×${h} puts the army 80% down and the read line above it`, () => {
      const aspect = w / h;
      const fit = cameraFor();
      const army = screenAt(fit, aspect, 0, 0, 0).y;
      expect(army).toBeCloseTo(0.8, 6);
      const view = screenAt(fit, aspect, 0, 0, viewZ).y;
      expect(view).toBeLessThan(army);
      expect(view).toBeGreaterThan(0.2);
      // the far line (the shape horizon) is above the read line, below the top
      const far = screenAt(fit, aspect, 0, 0, worldZ(SHAPE_DISTANCE, 0)).y;
      expect(far).toBeLessThan(view);
      expect(far).toBeGreaterThan(0);
      // the biggest crowd's near edge stays on screen
      const nearZ = (CROWD_MAX_W / 2) * CROWD_DEPTH * TRACK_W;
      expect(screenAt(fit, aspect, 0, 0, nearZ).y).toBeLessThan(1);
      // real perspective: the track at the read line is narrower than at the army
      const nearW = screenAt(fit, aspect, worldX(1), 0, 0).x - 0.5;
      const farW = screenAt(fit, aspect, worldX(1), 0, viewZ).x - 0.5;
      expect(farW).toBeLessThan(nearW * 0.9);
    });

  it("matches the owner's measurements at 390×844 (height 4.7, back 14.2)", () => {
    const { pose } = cameraFor();
    expect(pose.height).toBeCloseTo(4.73, 1);
    expect(pose.back).toBeCloseTo(14.23, 1);
  });

  it("spreads the haze over most of the screen: the gate at VIEW_DISTANCE is well below the horizon", () => {
    const fit = cameraFor();
    const at = (d: number): number =>
      screenAt(fit, 390 / 844, 0, 0, worldZ(d, 0)).y;
    // clear at the read line, total at the shape horizon: a wide band, not a sliver
    expect(at(VIEW_DISTANCE) - at(SHAPE_DISTANCE)).toBeGreaterThan(0.08);
  });
});

describe("camera settings", () => {
  const aspects = [390 / 844, 1280 / 800];

  it("keeps the army at the aim height and the chosen pitch, FOV and distance", () => {
    const s: CameraSettings = {
      pitch: 20,
      distance: 12,
      fov: 50,
      follow: 0,
      smoothing: 0.2,
      haze: 10,
    };
    const fit = poseFromSettings(s, AIM.armyY);
    const { pose } = fit;
    for (const a of aspects)
      expect(screenAt(fit, a, 0, 0, 0).y).toBeCloseTo(AIM.armyY, 6);
    expect(Math.hypot(pose.height, pose.back)).toBeCloseTo(12, 9);
    expect(
      (Math.atan2(pose.height, pose.back + pose.lookAhead) * 180) / Math.PI,
    ).toBeCloseTo(20, 9);
    expect(fit.fov).toBe(50);
  });

  it("keeps the haze total at the horizon in use and clear at VIEW_DISTANCE across camera extremes", () => {
    const d = DEFAULT_CAMERA;
    for (const pitch of [3, 8, 45])
      for (const distance of [6, 15, 60])
        for (const fov of [20, 34, 75])
          for (const horizon of [VIEW_DISTANCE + 1, SHAPE_DISTANCE, HAZE_MAX]) {
            const { pose } = poseFromSettings(
              { ...d, pitch, distance, fov },
              AIM.armyY,
            );
            const range = fogRange(pose, horizon);
            expect(range.far).toBeGreaterThan(range.near);
            for (const y of [0, WALL_H, FOG_TOP_H]) {
              const at = (dist: number): number =>
                hazeAt(range, viewDepth(pose, y, worldZ(dist, 0)));
              expect(at(horizon)).toBeGreaterThan(0.97);
              expect(at(VIEW_DISTANCE)).toBeLessThan(0.05);
            }
          }
  });

  it("has the default haze at SHAPE_DISTANCE, 4 × VIEW_DISTANCE, below the re-ask gap and the haze maximum", () => {
    expect(DEFAULT_CAMERA.haze).toBe(SHAPE_DISTANCE);
    expect(SHAPE_DISTANCE).toBe(4 * VIEW_DISTANCE);
    expect(shapeDistance()).toBe(SHAPE_DISTANCE);
    expect(SHAPE_DISTANCE).toBeLessThan(HAZE_MAX);
    expect(HAZE_MAX).toBeLessThan(
      REASK_GAP_MIN * (CALM_DISTANCE + 2 * HAZARD_SPACING),
    );
  });
});

describe("camera follow", () => {
  it("targets follow × the army's world x", () => {
    expect(followTarget(0, 1)).toBe(0);
    expect(followTarget(1, 1)).toBeCloseTo(worldX(1), 9);
    expect(followTarget(0.6, 0)).toBeCloseTo(0.6 * worldX(0), 9);
    expect(followTarget(1, 0.5)).toBeCloseTo(0, 9);
  });

  it("follow 0 keeps the camera at x = 0 and follow 1 settles on the army", () => {
    let x0 = 0;
    let x1 = 0;
    for (let i = 0; i < 600; i++) {
      x0 = followStep(x0, followTarget(0, 1), 1 / 60, 0.3);
      x1 = followStep(x1, followTarget(1, 1), 1 / 60, 0.3);
    }
    expect(x0).toBe(0);
    expect(x1).toBeCloseTo(worldX(1), 6);
  });

  it("snaps at 0 smoothing, and is continuous: a tiny step moves a tiny way", () => {
    expect(followStep(0, 3, 1 / 60, 0)).toBe(3);
    expect(followStep(0, 3, 0, 0.3)).toBe(0);
    expect(Math.abs(followStep(1, 3, 1e-6, 0.3) - 1)).toBeLessThan(1e-4);
  });

  it("is the same at 30 and 60 fps", () => {
    let a = 0;
    let b = 0;
    for (let i = 0; i < 30; i++) a = followStep(a, 2, 1 / 30, 0.5);
    for (let i = 0; i < 60; i++) b = followStep(b, 2, 1 / 60, 0.5);
    expect(a).toBeCloseTo(b, 9);
    // most of the gap (95%) closes in the smoothing time
    expect(followStep(0, 1, 0.5, 0.5)).toBeCloseTo(0.95, 2);
  });
});
