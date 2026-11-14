import { VIEW_DISTANCE } from "../../core/tuning";
import { SHAPE_DISTANCE, FOG_TOP_H, worldX, worldZ } from "./world";

/** Where the camera sits and what it looks at, in world units (centred on the track). */
export type CameraPose = {
  height: number;
  back: number;
  lookAhead: number;
  lookHeight: number;
};

/** Depth of a point (on the track's centre plane) along the camera's view direction. */
export function viewDepth(pose: CameraPose, y: number, z: number): number {
  const fy = pose.lookHeight - pose.height;
  const fz = -pose.lookAhead - pose.back;
  const len = Math.hypot(fy, fz);
  return ((y - pose.height) * fy + (z - pose.back) * fz) / len;
}

/**
 * Linear haze range (view depths): none up to VIEW_DISTANCE ahead, then
 * thickening steadily until it is total at the shape horizon (`horizon`) for
 * anything up to FOG_TOP_H tall, so a shape crossing it is already gone.
 */
export function fogRange(
  pose: CameraPose,
  horizon = SHAPE_DISTANCE,
): { near: number; far: number } {
  const z = worldZ(horizon, 0);
  return {
    near: viewDepth(pose, 0, worldZ(VIEW_DISTANCE, 0)),
    far: Math.min(viewDepth(pose, 0, z), viewDepth(pose, FOG_TOP_H, z)),
  };
}

/** How much haze (0 none .. 1 total) linear fog `range` puts at view depth `depth`. */
export function hazeAt(
  range: { near: number; far: number },
  depth: number,
): number {
  const t = (depth - range.near) / (range.far - range.near);
  return Math.min(1, Math.max(0, t));
}

/** Haze (0 none .. 1 total) at a track point `dist` ahead of the army (as in `Projector`), `height` up. */
export type Haze = (dist: number, height: number) => number;

/** The haze at track points for a camera `pose` with the army at `runDist`: what the fog gives the scene. */
export function hazeFor(
  pose: CameraPose,
  runDist: number,
  horizon = SHAPE_DISTANCE,
): Haze {
  const range = fogRange(pose, horizon);
  return (dist, height) =>
    hazeAt(range, viewDepth(pose, height, worldZ(dist, runDist)));
}

/** A posed camera and its vertical field of view (degrees). */
export type CameraFit = { pose: CameraPose; fov: number };

/** Screen position of a world point, as shares of the screen (0..1 from the left / top). */
export function screenAt(
  fit: CameraFit,
  aspect: number,
  x: number,
  y: number,
  z: number,
): { x: number; y: number } {
  const { pose } = fit;
  const pitch = Math.atan2(
    pose.height - pose.lookHeight,
    pose.back + pose.lookAhead,
  );
  const dy = y - pose.height;
  const dz = z - pose.back;
  const depth = -dy * Math.sin(pitch) - dz * Math.cos(pitch);
  const up = dy * Math.cos(pitch) - dz * Math.sin(pitch);
  const tanV = Math.tan((fit.fov * Math.PI) / 360);
  return {
    x: (1 + x / depth / (tanV * aspect)) / 2,
    y: (1 - up / depth / tanV) / 2,
  };
}

/**
 * Tunable camera settings. `pitch` is the view direction's downward tilt
 * (degrees), `distance` the camera-to-army distance (world units), `fov` the
 * vertical field of view (degrees), `follow` how much of the army's sideways
 * position the camera takes (0..1), `smoothing` the seconds it takes to close
 * most of the gap (0 = instant) and `haze` the shape horizon (track distance).
 */
export type CameraSettings = {
  pitch: number;
  distance: number;
  fov: number;
  follow: number;
  smoothing: number;
  haze: number;
};

/** The camera at every screen size, and what Reset returns to (the owner's pick at Checkpoint H2). */
export const DEFAULT_CAMERA: CameraSettings = {
  pitch: 8,
  distance: 15,
  fov: 34,
  follow: 0.4,
  smoothing: 1,
  haze: SHAPE_DISTANCE,
};

const RAD = Math.PI / 180;

/**
 * The camera for `s` around the army: the view looks `pitch` down, the army
 * sits `distance` away and `armyY` (share of the screen from the top) down
 * the screen, which fixes height and distance back.
 */
export function poseFromSettings(s: CameraSettings, armyY: number): CameraFit {
  const tanV = Math.tan((s.fov * RAD) / 2);
  // depression of the army: below the view axis by the army's screen offset
  const da = s.pitch * RAD + Math.atan((2 * armyY - 1) * tanV);
  const height = s.distance * Math.sin(da);
  const back = s.distance * Math.cos(da);
  return {
    pose: {
      height,
      back,
      lookAhead: height / Math.tan(s.pitch * RAD) - back,
      lookHeight: 0,
    },
    fov: s.fov,
  };
}

/** Where the camera wants to be sideways (world X): `follow` of the army's place on the track. */
export const followTarget = (follow: number, trackX: number): number =>
  follow * worldX(trackX);

/**
 * One easing step of the camera's sideways position: continuous, and the same
 * however the time is split into frames (exponential; 95% of the gap closes in
 * `smoothing` seconds, 0 snaps).
 */
export function followStep(
  current: number,
  target: number,
  dt: number,
  smoothing: number,
): number {
  if (smoothing <= 0) return target;
  return target + (current - target) * Math.exp((-3 * dt) / smoothing);
}
